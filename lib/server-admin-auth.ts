import { isAdminIdentity } from "@/lib/admin-access";

type FirestoreAdmin = {
  fields?: {
    enabled?: { booleanValue?: boolean };
    expiresAt?: { timestampValue?: string };
    inviteId?: { stringValue?: string };
    codeHash?: { stringValue?: string };
  };
};

export async function authorizeAdminRequest(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!token || !projectId || !apiKey) return false;
  try {
    const identityResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }), cache: "no-store",
    });
    if (!identityResponse.ok) return false;
    const identity = await identityResponse.json() as { users?: Array<{ localId?: string }> };
    const uid = identity.users?.[0]?.localId;
    if (!uid) return false;
    const adminResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (!adminResponse.ok) return false;
    const admin = await adminResponse.json() as FirestoreAdmin;
    return isAdminIdentity(uid, {
      enabled: admin.fields?.enabled?.booleanValue,
      expiresAt: Date.parse(admin.fields?.expiresAt?.timestampValue ?? ""),
      inviteId: admin.fields?.inviteId?.stringValue,
      codeHash: admin.fields?.codeHash?.stringValue,
    });
  } catch {
    return false;
  }
}
