import { NextResponse } from "next/server";
import { getAdminSessionExpiry } from "@/lib/admin-access";

type FirestoreDocument = {
  fields?: {
    email?: { stringValue?: string };
    used?: { booleanValue?: boolean };
    expiresAt?: { timestampValue?: string };
    enabled?: { booleanValue?: boolean };
    inviteId?: { stringValue?: string };
  };
};

function inviteUrl(projectId: string, inviteId: string, apiKey: string) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/adminInvites/${encodeURIComponent(inviteId)}?key=${encodeURIComponent(apiKey)}`;
}

function adminUrl(projectId: string, uid: string) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`;
}

export async function POST(request: Request) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    return NextResponse.json({ error: "Signup is not configured on the server." }, { status: 503 });
  }
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: { email?: unknown; password?: unknown; invite?: unknown; idToken?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { email, password, invite, idToken: providedIdToken } = body;
  if (typeof email !== "string" || typeof invite !== "string" ||
      (providedIdToken !== undefined && (typeof providedIdToken !== "string" || providedIdToken.length > 10000))) {
    return NextResponse.json({ error: "Use a valid administrator invitation and account credentials." }, { status: 400 });
  }
  if (email.length > 254 || (providedIdToken === undefined && (typeof password !== "string" || password.length < 6 || password.length > 128))) {
    return NextResponse.json({ error: "Enter a valid email and a password of at least 6 characters." }, { status: 400 });
  }
  if (invite.length < 16 || invite.length > 128 || !/^[A-Za-z0-9_-]+$/.test(invite)) {
    return NextResponse.json({ error: "This invitation link is invalid." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const invitationUrl = inviteUrl(projectId, invite, apiKey);

  try {
    const inviteResponse = await fetch(invitationUrl, { cache: "no-store" });
    if (!inviteResponse.ok) return NextResponse.json({ error: "This invitation has expired or was already used." }, { status: 403 });
    const invitation = await inviteResponse.json() as FirestoreDocument;
    const invitedEmail = invitation.fields?.email?.stringValue?.toLowerCase();
    const expiry = Date.parse(invitation.fields?.expiresAt?.timestampValue ?? "");
    if (invitation.fields?.used?.booleanValue !== false || invitedEmail !== normalizedEmail || expiry <= Date.now()) {
      return NextResponse.json({ error: "This invitation is expired, already used, or belongs to another email." }, { status: 403 });
    }

    let credentials: { idToken?: string; localId?: string };
    if (typeof providedIdToken === "string") {
      const identityResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: providedIdToken }),
        cache: "no-store",
      });
      const identity = await identityResponse.json() as { users?: Array<{ localId?: string; email?: string }> };
      const account = identity.users?.[0];
      if (!identityResponse.ok || !account?.localId || account.email?.toLowerCase() !== normalizedEmail) {
        return NextResponse.json({ error: "Sign in with the invited email address to accept this invitation." }, { status: 403 });
      }
      credentials = { idToken: providedIdToken, localId: account.localId };
    } else {
      const createResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password, returnSecureToken: true }),
        cache: "no-store",
      });
      if (createResponse.ok) {
        credentials = await createResponse.json() as typeof credentials;
      } else {
        const result = await createResponse.json() as { error?: { message?: string } };
        if (result.error?.message !== "EMAIL_EXISTS") {
          const message = result.error?.message === "INVALID_EMAIL"
            ? "Enter a valid email address."
            : "Could not create the account. Check the details and try again.";
          return NextResponse.json({ error: message }, { status: 400 });
        }
        const signInResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, password, returnSecureToken: true }),
          cache: "no-store",
        });
        if (!signInResponse.ok) return NextResponse.json({ error: "An account already exists for this email. Sign in or continue with the invited Google account." }, { status: 400 });
        credentials = await signInResponse.json() as typeof credentials;
      }
    }
    const { idToken, localId } = credentials;
    if (!idToken || !localId) {
      return NextResponse.json({ error: "Firebase did not return valid account credentials." }, { status: 502 });
    }

    const adminDocumentUrl = adminUrl(projectId, localId);
    const priorAdminResponse = await fetch(adminDocumentUrl, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });
    if (priorAdminResponse.ok) {
      const existing = await priorAdminResponse.json() as FirestoreDocument;
      const existingInvite = existing.fields?.inviteId?.stringValue;
      if (existing.fields?.enabled?.booleanValue !== true) {
        return NextResponse.json({ error: "This account is not eligible to accept that invitation." }, { status: 403 });
      }
      if (existingInvite !== invite) {
        if (typeof existingInvite === "string" && existingInvite.length >= 16) {
          return NextResponse.json({ error: "This account is already linked to a different administrator invitation." }, { status: 403 });
        }
        const migrationResponse = await fetch(`${adminDocumentUrl}?updateMask.fieldPaths=expiresAt&updateMask.fieldPaths=inviteId`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              expiresAt: { timestampValue: new Date(getAdminSessionExpiry()).toISOString() },
              inviteId: { stringValue: invite },
            },
          }),
          cache: "no-store",
        });
        if (!migrationResponse.ok) {
          return NextResponse.json({ error: "Could not activate this invitation for the existing administrator. Deploy the current firestore.rules and try again." }, { status: 403 });
        }
      }
    } else if (priorAdminResponse.status === 404 || priorAdminResponse.status === 403) {
      const adminResponse = await fetch(`${adminDocumentUrl}?updateMask.fieldPaths=enabled&updateMask.fieldPaths=expiresAt&updateMask.fieldPaths=inviteId`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            enabled: { booleanValue: true },
            expiresAt: { timestampValue: new Date(getAdminSessionExpiry()).toISOString() },
            inviteId: { stringValue: invite },
            sessionMigrated: { booleanValue: true },
          },
        }),
        cache: "no-store",
      });
      if (!adminResponse.ok) {
        const detail = await adminResponse.json().catch(() => ({})) as { error?: { status?: string } };
        return NextResponse.json({
          error: detail.error?.status === "PERMISSION_DENIED"
            ? "Firestore rejected this administrator invitation. Deploy the current firestore.rules and try again."
            : "Could not activate the invited administrator account.",
        }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Could not verify the invited administrator account." }, { status: 502 });
    }

    const acceptResponse = await fetch(`${invitationUrl}&updateMask.fieldPaths=used`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: { used: { booleanValue: true } } }),
      cache: "no-store",
    });
    if (!acceptResponse.ok) {
      return NextResponse.json({ error: "Your account is active, but the invitation could not be marked as used. Sign in and notify the root administrator." }, { status: 502 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (reason) {
    console.error("Administrator signup failed", reason);
    return NextResponse.json({ error: "Could not reach the authentication service. Please try again." }, { status: 502 });
  }
}
