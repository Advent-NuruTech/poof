import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import {
  createDonationQuote,
  DONATION_CURRENCY,
  PAYSTACK_CHARGE_CURRENCY,
} from "@/lib/donation-quote";
import { FieldValue, getMailDb, Timestamp } from "@/lib/mailing-server";
import { DonationError } from "@/lib/paystack-errors";

const PAYSTACK_API = "https://api.paystack.co";
const RECEIPT_LEASE_MS = 5 * 60 * 1000;

export type DonationStatus = "pending" | "success" | "failed";

type PaystackCustomer = { email?: string };
type PaystackTransaction = {
  id?: number;
  domain?: string;
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  paid_at?: string | null;
  created_at?: string;
  channel?: string;
  gateway_response?: string;
  customer?: PaystackCustomer;
  metadata?: Record<string, unknown> | string | null;
};

type PaystackResponse<T> = {
  status?: boolean;
  message?: string;
  data?: T;
};

type DonationInput = {
  name: string;
  email: string;
  originalAmountSubunit: number;
  originalCurrency: typeof DONATION_CURRENCY;
};

type StoredDonation = {
  name?: string;
  email?: string;
  amountSubunit?: number;
  currency?: string;
  originalAmountSubunit?: number;
  originalCurrency?: string;
  conversionRate?: number;
  chargeAmountSubunit?: number;
  chargeCurrency?: string;
  status?: DonationStatus;
  receiptStatus?: string;
  receiptLeaseUntil?: Timestamp;
};

export { DonationError } from "@/lib/paystack-errors";

export function paystackCurrencies() {
  return [PAYSTACK_CHARGE_CURRENCY];
}

export function paystackCurrency() {
  return PAYSTACK_CHARGE_CURRENCY;
}

function amountToSubunit(value: string, label: string) {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new DonationError(`${label} must be a valid amount with no more than two decimal places.`);
  }
  const [whole, fraction = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount)) throw new DonationError(`${label} is too large.`);
  return amount;
}

export function parseDonationInput(value: unknown): DonationInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DonationError("Enter your name, email address, and donation amount.");
  }
  const input = value as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const amount = typeof input.amount === "string" ? input.amount : "";
  const requestedCurrency = typeof input.currency === "string" ? input.currency.trim().toUpperCase() : DONATION_CURRENCY;

  if (name.length < 2 || name.length > 120) throw new DonationError("Enter your full name (2–120 characters).");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DonationError("Enter a valid email address for your receipt.");
  }

  const amountSubunit = amountToSubunit(amount, "Donation amount");
  if (amountSubunit <= 0) throw new DonationError("Donation amount must be greater than zero.");
  if (requestedCurrency !== DONATION_CURRENCY) throw new DonationError("Donations must be entered in USD.");

  return { name, email, originalAmountSubunit: amountSubunit, originalCurrency: DONATION_CURRENCY };
}

function paystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  if (!/^sk_(?:live|test)_/.test(secret)) throw new Error("PAYSTACK_SECRET_KEY is not a recognized Paystack secret key.");
  return secret;
}

function siteBaseUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
    }
    return url.origin;
  }
  const requestUrl = new URL(request.url);
  if (process.env.NODE_ENV === "production") throw new Error("NEXT_PUBLIC_SITE_URL must be configured for Paystack callbacks.");
  return requestUrl.origin;
}

async function paystackRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${PAYSTACK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${paystackSecret()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  let body: PaystackResponse<T> | null = null;
  try {
    body = await response.json() as PaystackResponse<T>;
  } catch {
    // The public caller receives a stable error below; provider HTML is never exposed.
  }
  if (!response.ok || !body?.status || !body.data) {
    const providerMessage = typeof body?.message === "string" ? body.message : `HTTP ${response.status}`;
    throw new Error(`Paystack request failed: ${providerMessage}`);
  }
  return body.data;
}

function clientFingerprint(request: Request, email: string) {
  const address = request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  return createHmac("sha256", paystackSecret()).update(`${address}|${email}`).digest("hex");
}

export async function enforceDonationRateLimit(request: Request, email: string) {
  const now = Date.now();
  const bucket = Math.floor(now / 3_600_000);
  const id = `${bucket}_${clientFingerprint(request, email)}`;
  const ref = getMailDb().collection("donationRateLimits").doc(id);
  const allowed = await getMailDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const count = Number(snapshot.get("count") ?? 0);
    if (count >= 10) return false;
    transaction.set(ref, {
      count: count + 1,
      updatedAt: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromMillis((bucket + 25) * 3_600_000),
    }, { merge: true });
    return true;
  });
  if (!allowed) throw new DonationError("Too many donation attempts. Please wait before trying again.", 429);
}

export function hasValidPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", paystackSecret()).update(rawBody).digest("hex");
  const receivedBuffer = Buffer.from(signature.toLowerCase(), "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function initializeDonation(request: Request, input: DonationInput) {
  const quote = await createDonationQuote(input.originalAmountSubunit);
  const db = getMailDb();
  const reference = `DON-${Date.now().toString(36)}-${randomBytes(12).toString("hex")}`;
  const donation = db.collection("donations").doc(reference);
  await donation.create({
    reference,
    name: input.name,
    email: input.email,
    originalAmountSubunit: quote.originalAmountSubunit,
    originalCurrency: quote.originalCurrency,
    conversionRate: quote.conversionRate,
    chargeAmountSubunit: quote.chargeAmountSubunit,
    chargeCurrency: quote.chargeCurrency,
    rateDate: quote.rateDate,
    rateSource: quote.rateSource,
    quotedAt: Timestamp.fromDate(new Date(quote.quotedAt)),
    quote,
    // These compatibility fields always describe the real Paystack charge.
    amountSubunit: quote.chargeAmountSubunit,
    currency: quote.chargeCurrency,
    status: "pending",
    providerStatus: "initializing",
    receiptStatus: "not_sent",
    successfulCount: 0,
    successfulAmountSubunit: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const baseUrl = siteBaseUrl(request);
    const result = await paystackRequest<{ authorization_url?: string; access_code?: string; reference?: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: String(quote.chargeAmountSubunit),
        currency: PAYSTACK_CHARGE_CURRENCY,
        reference,
        callback_url: `${baseUrl}/donate/complete`,
        // Card remains the universal fallback. Paystack only renders either
        // wallet when the merchant, browser, device, and saved card are eligible.
        channels: ["card", "apple_pay", "google_pay"],
        metadata: JSON.stringify({
          donation_reference: reference,
          donor_name: input.name,
          original_amount_subunit: quote.originalAmountSubunit,
          original_currency: quote.originalCurrency,
          conversion_rate: quote.conversionRate,
          charge_amount_subunit: quote.chargeAmountSubunit,
          charge_currency: quote.chargeCurrency,
          cancel_action: `${baseUrl}/donate?payment=cancelled`,
        }),
      }),
    });
    const authorizationUrl = result.authorization_url;
    if (!authorizationUrl || !isPaystackCheckoutUrl(authorizationUrl) || result.reference !== reference) {
      throw new Error("Paystack returned an invalid checkout response.");
    }
    await donation.update({
      providerStatus: "initialized",
      accessCodeHash: result.access_code ? createHash("sha256").update(result.access_code).digest("hex") : null,
      initializedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { authorizationUrl, reference, quote };
  } catch (reason) {
    console.error("Paystack donation initialization failed", { reference, error: reason });
    await donation.update({
      status: "failed",
      providerStatus: "initialization_failed",
      failureMessage: "Checkout could not be started.",
      updatedAt: FieldValue.serverTimestamp(),
    }).catch((updateError) => console.error("Donation initialization failure could not be recorded", { reference, error: updateError }));
    throw new DonationError("Secure checkout could not be started. Please try again.", 502);
  }
}

export function isPaystackCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "checkout.paystack.com" || url.hostname.endsWith(".paystack.com"));
  } catch {
    return false;
  }
}

function normalizeProviderStatus(status: string | undefined): DonationStatus {
  if (status === "success") return "success";
  if (["failed", "abandoned", "reversed"].includes(status ?? "")) return "failed";
  return "pending";
}

function failureMessage(transaction: PaystackTransaction) {
  if (transaction.status === "abandoned") return "The donor did not complete checkout.";
  if (transaction.status === "reversed") return "The transaction was reversed.";
  return transaction.gateway_response?.trim().slice(0, 300) || "Paystack reported that the payment failed.";
}

function emailMatches(first: string, second: string) {
  return first.trim().toLowerCase() === second.trim().toLowerCase();
}

async function applyVerifiedTransaction(transaction: PaystackTransaction, source: "callback" | "webhook" | "admin") {
  const reference = transaction.reference ?? "";
  if (!reference || !validReference(reference)) throw new DonationError("Paystack returned an invalid transaction reference.", 502);
  const db = getMailDb();
  const donationRef = db.collection("donations").doc(reference);

  const result = await db.runTransaction(async (dbTransaction) => {
    const snapshot = await dbTransaction.get(donationRef);
    if (!snapshot.exists) throw new DonationError("This donation reference was not found.", 404);
    const donation = snapshot.data() as StoredDonation;
    const providerStatus = transaction.status ?? "unknown";
    const expectedAmount = Number(donation.chargeAmountSubunit ?? donation.amountSubunit);
    const expectedCurrency = String(donation.chargeCurrency ?? donation.currency ?? "").toUpperCase();
    const expectedEmail = String(donation.email ?? "");
    const receivedAmount = Number(transaction.amount);
    const receivedCurrency = String(transaction.currency ?? "").toUpperCase();
    const receivedEmail = String(transaction.customer?.email ?? "");
    const matches = Number.isSafeInteger(receivedAmount)
      && receivedAmount === expectedAmount
      && receivedCurrency === expectedCurrency
      && emailMatches(receivedEmail, expectedEmail);
    const normalized = normalizeProviderStatus(providerStatus);
    const nextStatus: DonationStatus = normalized === "success" && !matches ? "failed" : normalized;
    const wasSuccessful = donation.status === "success";
    const finalStatus = wasSuccessful ? "success" : nextStatus;
    const update: Record<string, unknown> = {
      status: finalStatus,
      providerStatus,
      providerTransactionId: transaction.id ? String(transaction.id) : null,
      channel: transaction.channel ?? null,
      providerDomain: transaction.domain ?? null,
      verifiedAt: FieldValue.serverTimestamp(),
      verifiedBy: source,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (finalStatus === "success") {
      update.failureMessage = FieldValue.delete();
      update.successfulCount = 1;
      update.successfulAmountSubunit = expectedAmount;
      update.paidAt = transaction.paid_at && Number.isFinite(Date.parse(transaction.paid_at))
        ? Timestamp.fromDate(new Date(transaction.paid_at))
        : FieldValue.serverTimestamp();
    } else if (nextStatus === "failed") {
      update.failureMessage = matches
        ? failureMessage(transaction)
        : "Provider verification did not match the original donation details.";
    }
    dbTransaction.update(donationRef, update);
    if (finalStatus === "success" && !wasSuccessful) {
      dbTransaction.set(db.collection("donationStats").doc(expectedCurrency), {
        currency: expectedCurrency,
        successfulCount: FieldValue.increment(1),
        successfulAmountSubunit: FieldValue.increment(expectedAmount),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    return {
      status: finalStatus,
      name: String(donation.name ?? "Donor"),
      email: expectedEmail,
      amountSubunit: expectedAmount,
      currency: expectedCurrency,
      originalAmountSubunit: Number(donation.originalAmountSubunit ?? expectedAmount),
      originalCurrency: String(donation.originalCurrency ?? expectedCurrency).toUpperCase(),
      conversionRate: typeof donation.conversionRate === "number" ? donation.conversionRate : null,
      chargeAmountSubunit: expectedAmount,
      chargeCurrency: expectedCurrency,
      providerStatus,
      failureMessage: nextStatus === "failed" ? (matches ? failureMessage(transaction) : "Payment verification did not match this donation.") : "",
    };
  });

  return result;
}

export async function verifyAndReconcileDonation(
  reference: string,
  source: "callback" | "webhook" | "admin",
  options: { sendReceipt?: boolean } = {},
) {
  if (!validReference(reference)) throw new DonationError("Enter a valid donation reference.");
  const existing = await getMailDb().collection("donations").doc(reference).get();
  if (!existing.exists) throw new DonationError("This donation reference was not found.", 404);
  const transaction = await paystackRequest<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
  const donation = await applyVerifiedTransaction(transaction, source);
  if (donation.status === "success" && options.sendReceipt !== false) await sendDonationReceipt(reference);
  return donation;
}

export async function processPaystackWebhook(transaction: PaystackTransaction) {
  if (transaction.status !== "success") return;
  return verifyAndReconcileDonation(String(transaction.reference ?? ""), "webhook", { sendReceipt: false });
}

export function validReference(reference: string) {
  return /^[A-Za-z0-9._=-]{6,100}$/.test(reference);
}

export async function sendDonationReceipt(reference: string) {
  const db = getMailDb();
  const ref = db.collection("donations").doc(reference);
  const claimed = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const donation = snapshot.data() as StoredDonation;
    if (donation.status !== "success" || donation.receiptStatus === "sent") return null;
    if (donation.receiptStatus === "sending" && donation.receiptLeaseUntil instanceof Timestamp
      && donation.receiptLeaseUntil.toMillis() > Date.now()) return null;
    transaction.update(ref, {
      receiptStatus: "sending",
      receiptAttempts: FieldValue.increment(1),
      receiptLeaseUntil: Timestamp.fromMillis(Date.now() + RECEIPT_LEASE_MS),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      name: String(donation.name ?? "Donor"),
      email: String(donation.email ?? ""),
      originalAmountSubunit: Number(donation.originalAmountSubunit ?? donation.amountSubunit ?? 0),
      originalCurrency: String(donation.originalCurrency ?? donation.currency ?? paystackCurrency()),
      conversionRate: typeof donation.conversionRate === "number" ? donation.conversionRate : null,
      chargeAmountSubunit: Number(donation.chargeAmountSubunit ?? donation.amountSubunit ?? 0),
      chargeCurrency: String(donation.chargeCurrency ?? donation.currency ?? paystackCurrency()),
    };
  });
  if (!claimed) return;

  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be configured.");
    const originalAmount = formatMoney(claimed.originalAmountSubunit, claimed.originalCurrency);
    const chargeAmount = formatMoney(claimed.chargeAmountSubunit, claimed.chargeCurrency);
    const converted = claimed.originalCurrency !== claimed.chargeCurrency;
    const conversionRow = converted
      ? `<tr><td style="padding:16px;border-top:1px solid #e2e5e1;color:#69736e">Amount paid</td><td style="padding:16px;border-top:1px solid #e2e5e1;text-align:right;font-weight:700">${escapeHtml(chargeAmount)}</td></tr>${claimed.conversionRate ? `<tr><td style="padding:16px;border-top:1px solid #e2e5e1;color:#69736e">Exchange rate</td><td style="padding:16px;border-top:1px solid #e2e5e1;text-align:right">1 USD = ${escapeHtml(formatRate(claimed.conversionRate))} KES</td></tr>` : ""}`
      : "";
    const conversionText = converted
      ? `\nAmount paid: ${chargeAmount}${claimed.conversionRate ? `\nExchange rate: 1 USD = ${formatRate(claimed.conversionRate)} KES` : ""}`
      : "";
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://faithofthepioneers.org").replace(/\/+$/, "");
    const resend = new Resend(apiKey);
    const safeName = escapeHtml(claimed.name);
    const safeReference = escapeHtml(reference);
    const { error } = await resend.emails.send({
      from,
      to: claimed.email,
      subject: `Donation receipt — ${originalAmount}`,
      html: `<!doctype html><html><body style="margin:0;background:#f3f4f1;font-family:Arial,Helvetica,sans-serif;color:#172126"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 14px"><tr><td align="center"><table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:#fff;border:1px solid #dfe3dd;border-radius:14px;overflow:hidden"><tr><td style="padding:28px;background:#0098fb;color:#102e47;text-align:center"><div style="font-size:12px;letter-spacing:3px;font-weight:700;color:#102e47">FAITH OF THE PIONEERS</div><h1 style="margin:13px 0 0;font-size:26px">Donation receipt</h1></td></tr><tr><td style="padding:34px"><p style="margin:0 0 18px;font-size:17px;line-height:1.6">Dear ${safeName},</p><p style="margin:0 0 24px;color:#4f5a55;line-height:1.7">Thank you for supporting Faith of the Pioneers. Your payment was securely confirmed by Paystack.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e5e1;border-radius:10px"><tr><td style="padding:16px;color:#69736e">Donation amount</td><td style="padding:16px;text-align:right;font-size:20px;font-weight:700">${escapeHtml(originalAmount)}</td></tr>${conversionRow}<tr><td style="padding:16px;border-top:1px solid #e2e5e1;color:#69736e">Reference</td><td style="padding:16px;border-top:1px solid #e2e5e1;text-align:right;font-family:monospace">${safeReference}</td></tr></table><p style="margin:24px 0 0;color:#748079;font-size:12px;line-height:1.6">Keep this email for your records. This acknowledgement is not a tax receipt unless applicable law and the ministry's legal status provide otherwise.</p></td></tr><tr><td style="padding:20px;background:#f7f8f6;text-align:center;font-size:12px"><a href="${escapeHtml(siteUrl)}" style="color:#263e69">faithofthepioneers.org</a></td></tr></table></td></tr></table></body></html>`,
      text: `Dear ${claimed.name},\n\nThank you for supporting Faith of the Pioneers.\n\nDonation amount: ${originalAmount}${conversionText}\nReference: ${reference}\n\nYour payment was securely confirmed by Paystack. Keep this email for your records. This acknowledgement is not a tax receipt unless applicable law and the ministry's legal status provide otherwise.\n\n${siteUrl}`,
    }, {
      idempotencyKey: createHash("sha256").update(`donation-receipt:${reference}`).digest("hex"),
    });
    if (error) throw new Error(error.message);
    await ref.update({
      receiptStatus: "sent",
      receiptSentAt: FieldValue.serverTimestamp(),
      receiptLeaseUntil: FieldValue.delete(),
      receiptError: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (reason) {
    console.error("Donation receipt delivery failed", { reference, error: reason });
    await ref.update({
      receiptStatus: "failed",
      receiptError: reason instanceof Error ? reason.message.slice(0, 300) : "Receipt delivery failed.",
      receiptLeaseUntil: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }).catch((updateError) => console.error("Donation receipt failure could not be recorded", { reference, error: updateError }));
  }
}

export function formatMoney(amountSubunit: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amountSubunit / 100);
}

function formatRate(rate: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 6 }).format(rate);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}
