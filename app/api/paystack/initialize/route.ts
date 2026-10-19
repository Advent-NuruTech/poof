import {
  DonationError,
  enforceDonationRateLimit,
  initializeDonation,
  parseDonationInput,
} from "@/lib/paystack";

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: Request) {
  if (!validOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403, headers: noStoreHeaders });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 10_000) {
    return Response.json({ error: "Donation request is too large." }, { status: 413, headers: noStoreHeaders });
  }

  try {
    const body = await request.json() as unknown;
    if (body && typeof body === "object" && !Array.isArray(body) && (body as { website?: unknown }).website) {
      return Response.json({ error: "Could not submit this donation." }, { status: 400, headers: noStoreHeaders });
    }
    const input = parseDonationInput(body);
    await enforceDonationRateLimit(request, input.email);
    const donation = await initializeDonation(request, input);
    return Response.json(donation, { status: 201, headers: noStoreHeaders });
  } catch (reason) {
    if (reason instanceof DonationError) {
      return Response.json({ error: reason.message }, { status: reason.statusCode, headers: noStoreHeaders });
    }
    console.error("Donation initialization route failed", reason);
    return Response.json({ error: "Secure checkout is temporarily unavailable. Please try again." }, { status: 500, headers: noStoreHeaders });
  }
}
