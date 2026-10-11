import { createHmac, timingSafeEqual } from "node:crypto";
import { FieldValue, mailDb } from "@/lib/mailing-server";

function signature(id: string, secret: string) {
  return createHmac("sha256", secret).update(id).digest("hex");
}

async function unsubscribe(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const supplied = url.searchParams.get("sig") ?? "";
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;
  if (!secret || !/^[a-f\d]{64}$/i.test(id) || !/^[a-f\d]{64}$/i.test(supplied)) {
    return Response.json({ error: "This unsubscribe link is invalid." }, { status: 400 });
  }
  const expected = Buffer.from(signature(id, secret), "hex");
  const actual = Buffer.from(supplied, "hex");
  if (!timingSafeEqual(expected, actual)) return Response.json({ error: "This unsubscribe link is invalid." }, { status: 400 });
  return { id };
}

function page(message: string, action = "") {
  const safeAction = action.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const form = action ? `<form method="post" action="${safeAction}"><button type="submit">Unsubscribe</button></form>` : "";
  return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Newsletter preferences</title></head><body style="margin:0;background:#f4f5f2;font:16px Arial,sans-serif;color:#172126"><main style="max-width:520px;margin:12vh auto;padding:32px;background:#fff;border:1px solid #e5e8e4;border-radius:14px"><p style="color:#c51c31;font-size:12px;letter-spacing:2px">FAITH OF THE PIONEERS</p><h1 style="font-size:25px">${message}</h1>${form}</main><style>button{padding:12px 18px;border:0;border-radius:24px;background:#172126;color:#fff;font-weight:700;cursor:pointer}</style></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  try {
    const result = await unsubscribe(request);
    if (result instanceof Response) return result;
    return page("Would you like to unsubscribe?", new URL(request.url).href);
  } catch (error) {
    console.error("Newsletter unsubscribe confirmation failed", error);
    return Response.json({ error: "Could not validate this unsubscribe link." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const result = await unsubscribe(request);
    if (result instanceof Response) return result;
    await mailDb.collection("newsletterSubscribers").doc(result.id).update({
      status: "unsubscribed", unsubscribedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return page("You are unsubscribed from the newsletter.");
  }
  catch (error) {
    console.error("Newsletter unsubscribe failed", error);
    return Response.json({ error: "Could not process your unsubscribe request." }, { status: 500 });
  }
}
