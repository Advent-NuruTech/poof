import { createHash } from "node:crypto";
import { getMailDb, FieldValue, sendNewsletterWelcome } from "@/lib/mailing-server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    const emailValue = (body as { email?: unknown }).email;
    const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    const mailDb = getMailDb();
    const id = createHash("sha256").update(email).digest("hex");
    const subscriber = mailDb.collection("newsletterSubscribers").doc(id);
    const result = await mailDb.runTransaction(async (transaction) => {
      const prior = await transaction.get(subscriber);
      if (prior.exists && prior.get("status") === "active") return "already-subscribed";
      transaction.set(subscriber, {
        email,
        status: "active",
        source: "homepage",
        ...(prior.exists ? { createdAt: prior.get("createdAt") } : { createdAt: FieldValue.serverTimestamp() }),
        subscribedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return "subscribed";
    });
    if (result === "already-subscribed") return Response.json({ status: result });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      `https://${process.env.VERCEL_URL ?? new URL(request.url).host}`;
    try {
      const delivery = await sendNewsletterWelcome({ id, email }, baseUrl);
      if (delivery.failures.length) {
        console.error("Newsletter welcome email delivery failed", {
          subscriberId: id,
          error: delivery.failures[0].error,
        });
        return Response.json({
          status: result,
          welcomeEmailSent: false,
          welcomeEmailError: "Your subscription was saved, but the welcome email could not be sent. Please contact us for help.",
        }, { status: 201 });
      }
      return Response.json({ status: result, welcomeEmailSent: true }, { status: 201 });
    } catch (error) {
      console.error("Newsletter welcome email failed", { subscriberId: id, error });
      return Response.json({
        status: result,
        welcomeEmailSent: false,
        welcomeEmailError: "Your subscription was saved, but the welcome email could not be sent. Please contact us for help.",
      }, { status: 201 });
    }
  } catch (error) {
    console.error("Newsletter subscription failed", error);
    return Response.json({ error: "Could not save your subscription. Please try again." }, { status: 500 });
  }
}
