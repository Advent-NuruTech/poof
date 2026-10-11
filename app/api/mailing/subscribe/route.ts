import { createHash } from "node:crypto";
import { mailDb, FieldValue } from "@/lib/mailing-server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    const emailValue = (body as { email?: unknown }).email;
    const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
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
    return Response.json({ status: result }, { status: result === "subscribed" ? 201 : 200 });
  } catch (error) {
    console.error("Newsletter subscription failed", error);
    return Response.json({ error: "Could not save your subscription. Please try again." }, { status: 500 });
  }
}
