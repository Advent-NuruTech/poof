import { NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "poof_admin_session";
const SESSION_MS = 24 * 60 * 60 * 1000;

type DocumentFields = {
  enabled?: { booleanValue?: boolean };
  expiresAt?: { timestampValue?: string };
  codeHash?: { stringValue?: string };
};

// The signup code authorizes access to the admin pages. Only a hash of it is
// stored in Firestore so the code itself is never published.
async function hashSignupCode(code: string) {
  const data = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const signupCode = process.env.SIGN_UP_CODE;
  if (!apiKey || !projectId) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });

  let body: { idToken?: unknown; code?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { idToken, code } = body;
  if (typeof idToken !== "string" || idToken.length > 10000 || (code !== undefined && typeof code !== "string")) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  const identityResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }), cache: "no-store",
  });
  const identity = await identityResponse.json().catch(() => ({})) as { users?: Array<{ localId?: string; email?: string }> };
  const user = identity.users?.[0];
  const uid = user?.localId;
  if (!identityResponse.ok || !uid || !user.email) return NextResponse.json({ error: "Your sign-in expired. Sign in again." }, { status: 401 });

  const root = `projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
  const adminPath = `admins/${encodeURIComponent(uid)}`;
  const adminUrl = `https://firestore.googleapis.com/v1/${root}/${adminPath}`;
  const now = Date.now();
  const codeHash = signupCode ? await hashSignupCode(signupCode) : "";

  const priorResponse = await fetch(adminUrl, { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" });
  if (!priorResponse.ok && priorResponse.status !== 404) return NextResponse.json({ error: "Could not check administrator access." }, { status: 403 });
  const prior = priorResponse.ok ? await priorResponse.json() as { fields?: DocumentFields } : null;
  const priorExpiresAt = Date.parse(prior?.fields?.expiresAt?.timestampValue ?? "");
  const priorActive = prior?.fields?.enabled?.booleanValue === true && priorExpiresAt > now;
  const priorMatchesCode = prior?.fields?.codeHash?.stringValue === codeHash;

  if (priorActive && priorMatchesCode) {
    // This account's admin session is still valid; keep its original deadline.
    return setSessionCookie(idToken, priorExpiresAt - now);
  }

  // The signup code authorizes admin access. On first use the stored hash is
  // written; afterwards it must match so the code cannot be changed to take over.
  if (!codeHash || code !== signupCode || (prior?.fields?.codeHash?.stringValue && !priorMatchesCode)) {
    return NextResponse.json({ error: "The signup code is incorrect." }, { status: 403 });
  }

  const expiresAt = now + SESSION_MS;
  const writeResponse = await fetch(`${adminUrl}?updateMask.fieldPaths=enabled&updateMask.fieldPaths=expiresAt&updateMask.fieldPaths=codeHash`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { enabled: { booleanValue: true }, expiresAt: { timestampValue: new Date(expiresAt).toISOString() }, codeHash: { stringValue: codeHash } } }),
    cache: "no-store",
  });
  if (!writeResponse.ok) return NextResponse.json({ error: "Could not activate this admin session." }, { status: 403 });

  return setSessionCookie(idToken, SESSION_MS);
}

function setSessionCookie(idToken: string, maxAgeMs: number) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, idToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: Math.max(1, Math.floor(maxAgeMs / 1000)) });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
