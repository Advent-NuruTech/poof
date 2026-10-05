import Link from "next/link";
import { cookies } from "next/headers";

const SESSION_COOKIE = "poof_admin_session";

async function getAdminSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!token || !apiKey || !projectId) return false;
  try {
    const identityResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }), cache: "no-store",
    });
    const identity = await identityResponse.json() as { users?: Array<{ localId?: string }> };
    const uid = identity.users?.[0]?.localId;
    if (!identityResponse.ok || !uid) return false;
    const adminResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (!adminResponse.ok) return false;
    const admin = await adminResponse.json() as { fields?: { enabled?: { booleanValue?: boolean }; expiresAt?: { timestampValue?: string } } };
    return admin.fields?.enabled?.booleanValue === true && Date.parse(admin.fields.expiresAt?.timestampValue ?? "") > Date.now();
  } catch {
    return false;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!await getAdminSession()) return <main className="auth-page"><section className="auth-card sign-in-panel"><div className="panel-icon">◉</div><h1>Sign in to continue</h1><p>Your admin session is missing or expired. Sign in again to open the administrator pages.</p><Link className="primary-button" href="/signin">Go to sign in</Link></section></main>;
  return children;
}
