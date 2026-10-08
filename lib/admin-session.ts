import type { User } from "firebase/auth";

export async function startAdminSession(user: User) {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Could not start the administrator session.");
}

export async function endAdminSession() {
  await fetch("/api/auth/session", { method: "DELETE" });
}
