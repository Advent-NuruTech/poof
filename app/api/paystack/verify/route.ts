import { DonationError, validReference, verifyAndReconcileDonation } from "@/lib/paystack";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("reference")?.trim() ?? "";
  if (!validReference(reference)) {
    return Response.json({ error: "The donation reference is missing or invalid." }, { status: 400, headers: noStoreHeaders });
  }
  try {
    const donation = await verifyAndReconcileDonation(reference, "callback");
    return Response.json(donation, { headers: noStoreHeaders });
  } catch (reason) {
    if (reason instanceof DonationError) {
      return Response.json({ error: reason.message }, { status: reason.statusCode, headers: noStoreHeaders });
    }
    console.error("Donation callback verification failed", { reference, error: reason });
    return Response.json({ error: "We could not confirm this payment yet. Please refresh this page in a moment." }, { status: 502, headers: noStoreHeaders });
  }
}
