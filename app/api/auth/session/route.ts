import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminSessionExpiry, ROOT_ADMIN_UID, isAdminIdentity, isAdminSource } from "@/lib/admin-access";

const COOKIE_NAME = "poof_admin_session";
const ACCESS_COOKIE_NAME = "poof_admin_access";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

type AdminFields = {
  enabled?: { booleanValue?: boolean };
  expiresAt?: { timestampValue?: string };
  inviteId?: { stringValue?: string };
  codeHash?: { stringValue?: string };
  sessionMigrated?: { booleanValue?: boolean };
};

type RefreshedToken = {
  id_token?: string;
  refresh_token?: string;
  user_id?: string;
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

function adminUrl(uid: string) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID!)}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`;
}

async function refreshFirebaseToken(refreshToken: string): Promise<RefreshedToken | null> {
  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(API_KEY!)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return await response.json() as RefreshedToken;
}

async function readAdmin(uid: string, idToken: string) {
  const response = await fetch(adminUrl(uid), {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: "no-store",
  });
  if (!response.ok) return { response, fields: null };
  const document = await response.json() as { fields?: AdminFields };
  return { response, fields: document.fields ?? {} };
}

async function updateAdmin(uid: string, idToken: string, expiresAt: number, create: boolean) {
  const fields = create
    ? `updateMask.fieldPaths=enabled&updateMask.fieldPaths=expiresAt&updateMask.fieldPaths=sessionMigrated`
    : "updateMask.fieldPaths=expiresAt&updateMask.fieldPaths=sessionMigrated";
  const response = await fetch(`${adminUrl(uid)}?${fields}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        ...(create ? { enabled: { booleanValue: true } } : {}),
        expiresAt: { timestampValue: new Date(expiresAt).toISOString() },
        sessionMigrated: { booleanValue: true },
      },
    }),
    cache: "no-store",
  });
  return response;
}

function setSessionCookies(response: NextResponse, refreshToken: string, idToken: string, expiresAt: number) {
  const maxAge = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));
  response.cookies.set(COOKIE_NAME, refreshToken, cookieOptions(maxAge));
  response.cookies.set(ACCESS_COOKIE_NAME, idToken, cookieOptions(maxAge));
  return response;
}

function expiredSession() {
  const response = NextResponse.json({ error: "Your admin session expired. Sign in again." }, { status: 401 });
  response.cookies.set(COOKIE_NAME, "", cookieOptions(0));
  response.cookies.set(ACCESS_COOKIE_NAME, "", cookieOptions(0));
  return response;
}

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function renewSession(refreshToken: string, mode: "active" | "restore" | "fresh-sign-in") {
  if (!API_KEY || !PROJECT_ID) {
    return { response: NextResponse.json({ error: "Authentication is not configured." }, { status: 503 }) };
  }

  const refreshed = await refreshFirebaseToken(refreshToken);
  const uid = refreshed?.user_id;
  const idToken = refreshed?.id_token;
  if (!refreshed || !uid || !idToken) return { response: expiredSession() };

  const { response: adminResponse, fields } = await readAdmin(uid, idToken);
  const record = {
    enabled: fields?.enabled?.booleanValue,
    expiresAt: Date.parse(fields?.expiresAt?.timestampValue ?? ""),
    inviteId: fields?.inviteId?.stringValue,
    codeHash: fields?.codeHash?.stringValue,
    sessionMigrated: fields?.sessionMigrated?.booleanValue,
  };
  const recognized = isAdminSource(uid, record);
  if (adminResponse.status !== 404 && adminResponse.status !== 403 && !adminResponse.ok) {
    return { response: NextResponse.json({ error: "Could not verify administrator access." }, { status: 502 }) };
  }

  if (adminResponse.ok && record.enabled !== true) {
    return { response: expiredSession() };
  }
  if (adminResponse.ok && !recognized) {
    return { response: expiredSession() };
  }
  const withinIdleWindow = adminResponse.ok && isAdminIdentity(uid, record);
  const oneTimeLegacyRestore = mode === "restore" && adminResponse.ok &&
    record.enabled === true && recognized && record.sessionMigrated !== true;
  if (mode === "active" && !withinIdleWindow) {
    return { response: expiredSession() };
  }
  if (mode === "restore" && !withinIdleWindow && !oneTimeLegacyRestore) {
    return { response: expiredSession() };
  }
  if (!adminResponse.ok && uid !== ROOT_ADMIN_UID) {
    return { response: expiredSession() };
  }

  const expiresAt = getAdminSessionExpiry();
  const writeResponse = await updateAdmin(uid, idToken, expiresAt, !adminResponse.ok);
  if (!writeResponse.ok) {
    const detail = await writeResponse.json().catch(() => ({})) as { error?: { status?: string; message?: string } };
    console.error("Admin session renewal failed", writeResponse.status, detail.error?.message ?? "");
    return {
      response: NextResponse.json({
        error: detail.error?.status === "PERMISSION_DENIED"
          ? "Firestore rules rejected administrator access. Deploy the current firestore.rules and try again."
          : "Could not renew your administrator session.",
      }, { status: 403 }),
    };
  }

  return {
    idToken,
    uid,
    refreshToken: refreshed.refresh_token ?? refreshToken,
    expiresAt,
    response: null,
  };
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  let body: { refreshToken?: unknown; restore?: unknown; freshSignIn?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const refreshToken = body.refreshToken;
  if (typeof refreshToken !== "string" || refreshToken.length < 20 || refreshToken.length > 4096) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }
  if (body.restore === true && body.freshSignIn === true) {
    return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400 });
  }

  try {
    const mode = body.restore === true ? "restore" : body.freshSignIn === true ? "fresh-sign-in" : "restore";
    const result = await renewSession(refreshToken, mode);
    if (result.response) return result.response;
    return setSessionCookies(NextResponse.json({ ok: true }), result.refreshToken, result.idToken, result.expiresAt);
  } catch (reason) {
    console.error("Admin sign-in session could not be created", reason);
    return NextResponse.json({ error: "Could not verify administrator access. Please try again." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!API_KEY || !PROJECT_ID) {
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  }

  const refreshToken = (await cookies()).get(COOKIE_NAME)?.value;
  if (!refreshToken) return expiredSession();

  try {
    const result = await renewSession(refreshToken, "active");
    if (result.response) return result.response;
    return setSessionCookies(NextResponse.json({ ok: true }), result.refreshToken, result.idToken, result.expiresAt);
  } catch (reason) {
    console.error("Admin activity session could not be renewed", reason);
    return NextResponse.json({ error: "Could not renew your administrator session." }, { status: 502 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", cookieOptions(0));
  response.cookies.set(ACCESS_COOKIE_NAME, "", cookieOptions(0));
  return response;
}
