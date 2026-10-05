import { NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "poof_admin_session";
const SESSION_MS = 60 * 60 * 1000;

type DocumentFields = {
  enabled?: { booleanValue?: boolean };
  expiresAt?: { timestampValue?: string };
  email?: { stringValue?: string };
  used?: { booleanValue?: boolean };
};

export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });

  let body: { idToken?: unknown; bootstrapCode?: unknown; invite?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { idToken, bootstrapCode, invite } = body;
  if (typeof idToken !== "string" || idToken.length > 10000 || (bootstrapCode !== undefined && typeof bootstrapCode !== "string") || (invite !== undefined && typeof invite !== "string")) {
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
  const documentUrl = (path: string) => `https://firestore.googleapis.com/v1/${root}/${path}`;
  const adminPath = `admins/${encodeURIComponent(uid)}`;
  const adminUrl = documentUrl(adminPath);
  const priorResponse = await fetch(adminUrl, { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" });
  if (!priorResponse.ok && priorResponse.status !== 404) return NextResponse.json({ error: "Could not check administrator access." }, { status: 403 });
  const prior = priorResponse.ok ? await priorResponse.json() as { fields?: DocumentFields } : null;
  const now = Date.now();
  let expiresAt = Date.parse(prior?.fields?.expiresAt?.timestampValue ?? "");

  if (prior && prior.fields?.enabled?.booleanValue === true && expiresAt > now) {
    // Keep the original deadline on this account's current admin session.
  } else if (prior) {
    expiresAt = now + SESSION_MS;
    const renewResponse = await fetch(`${adminUrl}?updateMask.fieldPaths=enabled&updateMask.fieldPaths=expiresAt`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { enabled: { booleanValue: true }, expiresAt: { timestampValue: new Date(expiresAt).toISOString() } } }),
      cache: "no-store",
    });
    if (!renewResponse.ok) return NextResponse.json({ error: "Could not renew administrator access. Sign in again or ask for a new invitation." }, { status: 403 });
  } else {
    expiresAt = now + SESSION_MS;
    const writes: Array<Record<string, unknown>> = [];
    if (typeof invite === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(invite)) {
      const inviteUrl = documentUrl(`adminInvites/${encodeURIComponent(invite)}`);
      const inviteResponse = await fetch(inviteUrl, { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" });
      const invitation = inviteResponse.ok ? await inviteResponse.json() as { fields?: DocumentFields; updateTime?: string } : null;
      const inviteExpiry = Date.parse(invitation?.fields?.expiresAt?.timestampValue ?? "");
      if (!invitation || invitation.fields?.used?.booleanValue !== false || invitation.fields?.email?.stringValue?.toLowerCase() !== user.email.toLowerCase() || inviteExpiry <= now) {
        return NextResponse.json({ error: "This administrator invitation is invalid, expired, or belongs to another email." }, { status: 403 });
      }
      writes.push({
        update: { name: `projects/${projectId}/databases/(default)/documents/adminInvites/${invite}`, fields: { used: { booleanValue: true } } },
        updateMask: { fieldPaths: ["used"] },
        ...(invitation.updateTime ? { currentDocument: { updateTime: invitation.updateTime } } : {}),
      });
      writes.push({
        update: { name: `projects/${projectId}/databases/(default)/documents/${adminPath}`, fields: { enabled: { booleanValue: true }, expiresAt: { timestampValue: new Date(expiresAt).toISOString() }, inviteId: { stringValue: invite } } },
        currentDocument: { exists: false },
      });
    } else if (process.env.SIGN_UP_CODE && bootstrapCode === process.env.SIGN_UP_CODE) {
      writes.push({
        update: { name: `projects/${projectId}/databases/(default)/documents/${adminPath}`, fields: { enabled: { booleanValue: true }, expiresAt: { timestampValue: new Date(expiresAt).toISOString() } } },
        currentDocument: { exists: false },
      });
      writes.push({
        update: { name: `projects/${projectId}/databases/(default)/documents/adminBootstrap/claimed`, fields: { ownerUid: { stringValue: uid } } },
        currentDocument: { exists: false },
      });
    } else {
      return NextResponse.json({ error: "Admin access needs a valid two-hour invitation. The first admin can enter the signup code to bootstrap access." }, { status: 403 });
    }

    const commit = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:commit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ writes }),
      cache: "no-store",
    });
    if (!commit.ok) return NextResponse.json({ error: "Could not activate this admin session. The bootstrap may already be claimed or the invitation may have been used." }, { status: 403 });
  }

  const maxAge = Math.max(1, Math.min(60 * 60, Math.floor((expiresAt - now) / 1000)));
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, idToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
