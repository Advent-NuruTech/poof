import { after } from "next/server";
import {
  DonationError,
  hasValidPaystackSignature,
  processPaystackWebhook,
  sendDonationReceipt,
} from "@/lib/paystack";

type PaystackEvent = {
  event?: string;
  data?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) return new Response("Payload too large", { status: 413 });

  const rawBody = await request.text();
  if (!hasValidPaystackSignature(rawBody, request.headers.get("x-paystack-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: PaystackEvent;
  try {
    payload = JSON.parse(rawBody) as PaystackEvent;
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }
  if (payload.event !== "charge.success" || !payload.data) return new Response("OK", { status: 200 });
  const reference = typeof payload.data.reference === "string" ? payload.data.reference : "";
  if (!reference.startsWith("DON-")) return new Response("OK", { status: 200 });

  try {
    const donation = await processPaystackWebhook(payload.data);
    if (donation?.status === "success") {
      after(async () => {
        try {
          await sendDonationReceipt(reference);
        } catch (reason) {
          console.error("Post-response donation receipt task failed", { reference, error: reason });
        }
      });
    }
    return new Response("OK", { status: 200 });
  } catch (reason) {
    if (reason instanceof DonationError && reason.statusCode === 404) {
      console.warn("Ignoring a signed Paystack webhook for an unknown donation", { reference });
      return new Response("OK", { status: 200 });
    }
    console.error("Paystack webhook processing failed", { reference, error: reason });
    return new Response("Webhook processing failed", { status: 500 });
  }
}
