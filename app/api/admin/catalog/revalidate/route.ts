import { revalidateTag } from "next/cache";
import { isAdminIdentity } from "@/lib/admin-access";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/catalog-feed-types";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!token || !projectId || !apiKey) {
    return Response.json({ error: "Administrator authentication is required." }, { status: 401 });
  }

  try {
    const identityResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      cache: "no-store",
    });
    if (!identityResponse.ok) {
      return Response.json({ error: "Sign in again to refresh the public schedule." }, { status: 401 });
    }
    const identity = await identityResponse.json() as { users?: Array<{ localId?: string }> };
    const uid = identity.users?.[0]?.localId;
    if (!uid) return Response.json({ error: "Invalid administrator session." }, { status: 401 });

    const adminResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!adminResponse.ok) {
      return Response.json({ error: "Administrator access is required." }, { status: 403 });
    }
    const admin = await adminResponse.json() as {
      fields?: {
        enabled?: { booleanValue?: boolean };
        expiresAt?: { timestampValue?: string };
        inviteId?: { stringValue?: string };
        codeHash?: { stringValue?: string };
      };
    };
    if (!isAdminIdentity(uid, {
      enabled: admin.fields?.enabled?.booleanValue,
      expiresAt: Date.parse(admin.fields?.expiresAt?.timestampValue ?? ""),
      inviteId: admin.fields?.inviteId?.stringValue,
      codeHash: admin.fields?.codeHash?.stringValue,
    })) {
      return Response.json({ error: "Administrator access is required." }, { status: 403 });
    }

    revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
    return Response.json({ revalidated: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    console.error("Could not refresh the public catalog after an administrator change.", reason);
    return Response.json({ error: "The public catalog could not be refreshed." }, { status: 500 });
  }
}
