import { AggregateField, Timestamp } from "firebase-admin/firestore";
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
    const [records, success, failed, pending, ...currencyTotals] = await Promise.all([
      donationsRef.orderBy("createdAt", "desc").limit(250).get(),
      donationsRef.where("status", "==", "success").count().get(),
      donationsRef.where("status", "==", "failed").count().get(),
      donationsRef.where("status", "==", "pending").count().get(),
      ...currencies.map((currency) => donationsRef.where("currency", "==", currency).aggregate({
        count: AggregateField.sum("successfulCount"),
        amountSubunit: AggregateField.sum("successfulAmountSubunit"),
      }).get()),
    ]);
    const items = records.docs.map(donationDto);
    return Response.json({
      donations: items,
      summary: {
        successfulCount: Number(success.data().count ?? 0),
        failedCount: Number(failed.data().count ?? 0),
        pendingCount: Number(pending.data().count ?? 0),
        totals: currencies.map((currency, index) => ({
          currency,
          successfulCount: Number(currencyTotals[index].data().count ?? 0),
          successfulAmountSubunit: Number(currencyTotals[index].data().amountSubunit ?? 0),
        })),
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
