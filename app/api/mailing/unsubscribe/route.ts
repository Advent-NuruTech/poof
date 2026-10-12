import { createHmac, timingSafeEqual } from "node:crypto";
import { FieldValue, getMailDb } from "@/lib/mailing-server";

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
  const safeMessage = message.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
  return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Email preferences | Faith of the Pioneers</title></head><body style="margin:0;background:#f1f3f2;font:16px Arial,Helvetica,sans-serif;color:#172126"><main style="box-sizing:border-box;width:min(520px,calc(100% - 32px));margin:12vh auto;padding:clamp(24px,7vw,42px);background:#fff;border:1px solid #e1e5e2;border-radius:16px;box-shadow:0 16px 48px #17212612;text-align:center"><p style="color:#8b7028;font-size:11px;font-weight:750;letter-spacing:2px">FAITH OF THE PIONEERS</p><h1 style="font-size:clamp(25px,6vw,32px);line-height:1.2">${safeMessage}</h1>${form}<p style="margin-top:22px;color:#78817c;font-size:12px;line-height:1.6">You are in control of your inbox. You can safely close this page if you did not request to unsubscribe.</p></main><style>button{width:100%;min-height:48px;padding:12px 18px;border:0;border-radius:8px;background:#172126;color:#fff;font:700 15px Arial,Helvetica,sans-serif;cursor:pointer}button:hover{background:#263e69}</style></body></html>`, {
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
    const mailDb = getMailDb();
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
