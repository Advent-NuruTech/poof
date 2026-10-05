import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const expectedCode = process.env.SIGN_UP_CODE;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    return NextResponse.json({ error: "Signup is not configured on the server." }, { status: 503 });
  }

  let body: { code?: unknown; email?: unknown; password?: unknown; invite?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { code, email, password, invite } = body;
  if (typeof email !== "string" || typeof password !== "string" || (code !== undefined && typeof code !== "string") || (invite !== undefined && typeof invite !== "string")) {
    return NextResponse.json({ error: "Enter a valid email, password, and signup code or invitation." }, { status: 400 });
  }
  if (email.length > 254 || password.length < 6 || password.length > 128) {
    return NextResponse.json({ error: "Enter a valid email and a password of at least 6 characters." }, { status: 400 });
  }
  let invitePath = "";
  if (invite) {
    if (invite.length < 16 || invite.length > 128 || !/^[A-Za-z0-9_-]+$/.test(invite)) return NextResponse.json({ error: "This invitation link is invalid." }, { status: 400 });
    invitePath = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/adminInvites/${encodeURIComponent(invite)}`;
    const inviteResponse = await fetch(invitePath, { cache: "no-store" });
    if (!inviteResponse.ok) return NextResponse.json({ error: "This invitation has expired or was already used." }, { status: 403 });
    const invitation = await inviteResponse.json() as { fields?: { email?: { stringValue?: string }; used?: { booleanValue?: boolean }; expiresAt?: { timestampValue?: string } } };
    const invitedEmail = invitation.fields?.email?.stringValue?.toLowerCase();
    const expiry = Date.parse(invitation.fields?.expiresAt?.timestampValue ?? "");
    if (invitation.fields?.used?.booleanValue !== false || invitedEmail !== email.trim().toLowerCase() || expiry <= Date.now()) {
      return NextResponse.json({ error: "This invitation is expired, already used, or belongs to another email." }, { status: 403 });
    }
  } else if (!expectedCode || code !== expectedCode) {
    return NextResponse.json({ error: "The signup code is incorrect." }, { status: 403 });
  }

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password, returnSecureToken: true }),
      cache: "no-store",
    });
    if (!response.ok) {
      const result = await response.json() as { error?: { message?: string } };
      const message = result.error?.message === "EMAIL_EXISTS" ? "An account with this email already exists." :
        result.error?.message === "INVALID_EMAIL" ? "Enter a valid email address." : "Could not create the account. Check the details and try again.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const created = await response.json() as { idToken?: string };
    if (invite && created.idToken) {
      const acceptResponse = await fetch(`${invitePath}?updateMask.fieldPaths=used`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${created.idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { used: { booleanValue: true } } }),
        cache: "no-store",
      });
      if (!acceptResponse.ok) return NextResponse.json({ error: "The account was created, but the invitation could not be accepted. Sign in and ask an administrator to send a new invite." }, { status: 502 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not reach the authentication service." }, { status: 502 });
  }
}
