import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminSessionHeartbeat from "@/components/admin/admin-session-heartbeat";
import AdminSidebar from "@/components/admin/admin-sidebar";
import { isAdminIdentity } from "@/lib/admin-access";

export const metadata: Metadata = {
  title: "Administrator",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

const ACCESS_COOKIE = "poof_admin_access";

// Keep authentication request-bound under Cache Components.
export const instant = false;

async function getAdminSession() {
  const idToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!idToken || !apiKey || !projectId) return false;

  try {
    const identityResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    });
    const identity = await identityResponse.json() as { users?: Array<{ localId?: string }> };
    const uid = identity.users?.[0]?.localId;
    if (!identityResponse.ok || !uid) return false;

    const adminResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });
    if (!adminResponse.ok) return false;

    const admin = await adminResponse.json() as {
      fields?: {
        enabled?: { booleanValue?: boolean };
        expiresAt?: { timestampValue?: string };
        inviteId?: { stringValue?: string };
        codeHash?: { stringValue?: string };
      };
    };
    return isAdminIdentity(uid, {
      enabled: admin.fields?.enabled?.booleanValue,
      expiresAt: Date.parse(admin.fields?.expiresAt?.timestampValue ?? ""),
      inviteId: admin.fields?.inviteId?.stringValue,
      codeHash: admin.fields?.codeHash?.stringValue,
    });
  } catch (reason) {
    console.error("Admin page session verification failed", reason);
    return false;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!await getAdminSession()) redirect("/signin?next=%2Fpoof%2Fadmin");
  return <div className="admin-workspace"><AdminSessionHeartbeat/><AdminSidebar/><div className="admin-workspace-page">{children}</div></div>;
}
