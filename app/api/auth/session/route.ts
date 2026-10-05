import { NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "poof_admin_session";
const SESSION_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });

  let idToken: unknown;
  try { idToken = (await request.json() as { idToken?: unknown }).idToken; }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof idToken !== "string" || idToken.length > 10000) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

  const identityResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }), cache: "no-store",
  });
  const identity = await identityResponse.json().catch(() => ({})) as { users?: Array<{ localId?: string }> };
  const uid = identity.users?.[0]?.localId;
  if (!identityResponse.ok || !uid) return NextResponse.json({ error: "Your sign-in expired. Sign in again." }, { status: 401 });

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`;
  const priorResponse = await fetch(baseUrl, { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" });
  if (!priorResponse.ok && priorResponse.status !== 404) return NextResponse.json({ error: "Could not check administrator access." }, { status: 403 });
  const prior = priorResponse.ok ? await priorResponse.json() as { fields?: { expiresAt?: { timestampValue?: string } } } : null;
  const now = Date.now();
  const oldExpiry = Date.parse(prior?.fields?.expiresAt?.timestampValue ?? "");
  let expiresAt: number;
  if (prior && oldExpiry > now) {
    expiresAt = oldExpiry;
  } else {
    expiresAt = now + SESSION_MS;
    const method = prior ? "PATCH" : "POST";
    const target = prior ? `${baseUrl}?updateMask.fieldPaths=enabled&updateMask.fieldPaths=expiresAt` : `${baseUrl.slice(0, baseUrl.lastIndexOf("/"))}?documentId=${encodeURIComponent(uid)}`;
    const grantResponse = await fetch(target, {
      method,
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { enabled: { booleanValue: true }, expiresAt: { timestampValue: new Date(expiresAt).toISOString() } } }),
      cache: "no-store",
    });
    if (!grantResponse.ok) return NextResponse.json({ error: "Could not enable administrator access. Check the deployed Firestore rules." }, { status: 403 });
  }

  const maxAge = Math.max(1, Math.floor((expiresAt - now) / 1000));
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, idToken, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
