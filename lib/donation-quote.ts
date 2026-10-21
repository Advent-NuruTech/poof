import "server-only";

import { DonationError } from "@/lib/paystack-errors";

const RATE_ENDPOINT = "https://api.frankfurter.dev/v2/rate/USD/KES";
const RATE_SCALE = BigInt(1_000_000);
const PAYSTACK_KES_MINIMUM_SUBUNIT = 300;

export const DONATION_CURRENCY = "USD" as const;
export const PAYSTACK_CHARGE_CURRENCY = "KES" as const;

type RateDetails = {
  normalizedRate: string;
  rate: number;
  rateDate: string;
  rateSource: "configured" | "frankfurter";
};

export type DonationQuote = {
  originalAmountSubunit: number;
  originalCurrency: typeof DONATION_CURRENCY;
  conversionRate: number;
  chargeAmountSubunit: number;
  chargeCurrency: typeof PAYSTACK_CHARGE_CURRENCY;
  rateDate: string;
  rateSource: RateDetails["rateSource"];
  quotedAt: string;
};

function normalizeRate(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("DONATION_USD_KES_RATE must be a positive number with no more than six decimal places.");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const normalizedRate = `${whole}.${fraction.padEnd(6, "0")}`;
  const rate = Number(normalizedRate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100_000) {
    throw new Error("DONATION_USD_KES_RATE is outside the supported range.");
  }
  return { normalizedRate, rate };
}

async function usdKesRate(): Promise<RateDetails> {
  const configured = process.env.DONATION_USD_KES_RATE?.trim();
  if (configured) {
    return {
      ...normalizeRate(configured),
      rateDate: new Date().toISOString().slice(0, 10),
      rateSource: "configured",
    };
  }

  const response = await fetch(RATE_ENDPOINT, {
    cache: "force-cache",
    next: { revalidate: 60 * 60 },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`USD/KES exchange-rate request failed with HTTP ${response.status}.`);
  const payload = await response.json() as { base?: unknown; quote?: unknown; rate?: unknown; date?: unknown };
  if (payload.base !== DONATION_CURRENCY || payload.quote !== PAYSTACK_CHARGE_CURRENCY
    || typeof payload.rate !== "number" || !Number.isFinite(payload.rate)
    || typeof payload.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    throw new Error("USD/KES exchange-rate response was invalid.");
  }
  return {
    ...normalizeRate(payload.rate.toFixed(6)),
    rateDate: payload.date,
    rateSource: "frankfurter",
  };
}

export async function createDonationQuote(originalAmountSubunit: number): Promise<DonationQuote> {
  if (!Number.isSafeInteger(originalAmountSubunit) || originalAmountSubunit <= 0) {
    throw new DonationError("Donation amount must be greater than zero.");
  }
  const details = await usdKesRate();
  const rateMicros = BigInt(details.normalizedRate.replace(".", ""));
  const unrounded = BigInt(originalAmountSubunit) * rateMicros;
  const chargeAmount = (unrounded + RATE_SCALE / BigInt(2)) / RATE_SCALE;
  if (chargeAmount > BigInt(Number.MAX_SAFE_INTEGER)) throw new DonationError("Donation amount is too large.");
  const chargeAmountSubunit = Number(chargeAmount);
  if (chargeAmountSubunit < PAYSTACK_KES_MINIMUM_SUBUNIT) {
    throw new DonationError("Donation amount converts to less than Paystack's KES 3.00 minimum.");
  }
  return {
    originalAmountSubunit,
    originalCurrency: DONATION_CURRENCY,
    conversionRate: details.rate,
    chargeAmountSubunit,
    chargeCurrency: PAYSTACK_CHARGE_CURRENCY,
    rateDate: details.rateDate,
    rateSource: details.rateSource,
    quotedAt: new Date().toISOString(),
  };
}
