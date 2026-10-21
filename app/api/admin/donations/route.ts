import { Timestamp } from "firebase-admin/firestore";
import { getMailDb, requireMailAdmin } from "@/lib/mailing-server";
import { DonationError, paystackCurrencies, verifyAndReconcileDonation } from "@/lib/paystack";

const noStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };

function jsonDate(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function donationDto(snapshot: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = snapshot.data();
  return {
    reference: snapshot.id,
    name: String(data.name ?? "Unknown donor"),
    email: String(data.email ?? ""),
    amountSubunit: Number(data.amountSubunit ?? 0),
    currency: String(data.currency ?? "KES"),
    originalAmountSubunit: Number(data.originalAmountSubunit ?? data.amountSubunit ?? 0),
    originalCurrency: String(data.originalCurrency ?? data.currency ?? "KES"),
    conversionRate: typeof data.conversionRate === "number" ? data.conversionRate : null,
    chargeAmountSubunit: Number(data.chargeAmountSubunit ?? data.amountSubunit ?? 0),
    chargeCurrency: String(data.chargeCurrency ?? data.currency ?? "KES"),
    status: String(data.status ?? "pending"),
    providerStatus: String(data.providerStatus ?? "unknown"),
    failureMessage: typeof data.failureMessage === "string" ? data.failureMessage : "",
    receiptStatus: String(data.receiptStatus ?? "not_sent"),
    receiptError: typeof data.receiptError === "string" ? data.receiptError : "",
    channel: typeof data.channel === "string" ? data.channel : "",
    createdAt: jsonDate(data.createdAt),
    paidAt: jsonDate(data.paidAt),
    updatedAt: jsonDate(data.updatedAt),
  };
}

export async function GET(request: Request) {
  try {
    if (!await requireMailAdmin(request)) {
      return Response.json({ error: "Administrator access is required." }, { status: 403, headers: noStoreHeaders });
    }
    const db = getMailDb();
    const donationsRef = db.collection("donations");
    const currencies = paystackCurrencies();
    const [records, success, failed, pending, storedTotals] = await Promise.all([
      donationsRef.orderBy("createdAt", "desc").limit(250).get(),
      donationsRef.where("status", "==", "success").count().get(),
      donationsRef.where("status", "==", "failed").count().get(),
      donationsRef.where("status", "==", "pending").count().get(),
      db.collection("donationStats").get(),
    ]);
    const totals = new Map<string, { currency: string; successfulCount: number; successfulAmountSubunit: number }>(currencies.map((currency) => [currency, {
      currency,
      successfulCount: 0,
      successfulAmountSubunit: 0,
    }]));
    for (const snapshot of storedTotals.docs) {
      const currency = snapshot.id.toUpperCase();
      const successfulCount = Number(snapshot.get("successfulCount"));
      const successfulAmountSubunit = Number(snapshot.get("successfulAmountSubunit"));
      if (!/^[A-Z]{3}$/.test(currency) || !Number.isSafeInteger(successfulCount) || successfulCount < 0
        || !Number.isSafeInteger(successfulAmountSubunit) || successfulAmountSubunit < 0) continue;
      totals.set(currency, { currency, successfulCount, successfulAmountSubunit });
    }
    const successfulCount = Number(success.data().count ?? 0);
    const storedSuccessfulCount = [...totals.values()].reduce((sum, total) => sum + total.successfulCount, 0);
    if (storedSuccessfulCount !== successfulCount) {
      // Legacy fallback: derive an exact result without a composite index if
      // donations predate the transactional donationStats documents.
      for (const currency of totals.keys()) totals.set(currency, { currency, successfulCount: 0, successfulAmountSubunit: 0 });
      const successfulRecords = await donationsRef.where("status", "==", "success").select("chargeCurrency", "chargeAmountSubunit", "currency", "amountSubunit").get();
      for (const snapshot of successfulRecords.docs) {
        const currency = String(snapshot.get("chargeCurrency") ?? snapshot.get("currency") ?? "").toUpperCase();
        const amountSubunit = Number(snapshot.get("chargeAmountSubunit") ?? snapshot.get("amountSubunit"));
        if (!/^[A-Z]{3}$/.test(currency) || !Number.isSafeInteger(amountSubunit) || amountSubunit <= 0) continue;
        const current = totals.get(currency) ?? { currency, successfulCount: 0, successfulAmountSubunit: 0 };
        current.successfulCount += 1;
        current.successfulAmountSubunit += amountSubunit;
        totals.set(currency, current);
      }
    }
    const items = records.docs.map(donationDto);
    return Response.json({
      donations: items,
      summary: {
        successfulCount,
        failedCount: Number(failed.data().count ?? 0),
        pendingCount: Number(pending.data().count ?? 0),
        totals: [...totals.values()],
      },
    }, { headers: noStoreHeaders });
  } catch (reason) {
    console.error("Admin donations could not be loaded", reason);
    return Response.json({ error: "Could not load donations." }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  try {
    if (!await requireMailAdmin(request)) {
      return Response.json({ error: "Administrator access is required." }, { status: 403, headers: noStoreHeaders });
    }
    const donations = getMailDb().collection("donations");
    const [pending, receiptRetries] = await Promise.all([
      donations.where("status", "==", "pending").limit(30).get(),
      donations.where("receiptStatus", "in", ["failed", "not_sent"]).limit(20).get(),
    ]);
    const records = new Map(pending.docs.map((snapshot) => [snapshot.id, snapshot]));
    for (const snapshot of receiptRetries.docs) {
      if (snapshot.get("status") === "success") records.set(snapshot.id, snapshot);
    }
    let updated = 0;
    let unavailable = 0;
    const snapshots = [...records.values()];
    for (let start = 0; start < snapshots.length; start += 5) {
      const results = await Promise.all(snapshots.slice(start, start + 5).map(async (snapshot) => {
        try {
          await verifyAndReconcileDonation(snapshot.id, "admin");
          return true;
        } catch (reason) {
          if (!(reason instanceof DonationError)) console.error("Donation reconciliation failed", { reference: snapshot.id, error: reason });
          return false;
        }
      }));
      updated += results.filter(Boolean).length;
      unavailable += results.filter((result) => !result).length;
    }
    return Response.json({ checked: pending.size, receiptRetries: records.size - pending.size, updated, unavailable }, { headers: noStoreHeaders });
  } catch (reason) {
    console.error("Admin donation reconciliation failed", reason);
    return Response.json({ error: "Could not refresh donation statuses." }, { status: 500, headers: noStoreHeaders });
  }
}
