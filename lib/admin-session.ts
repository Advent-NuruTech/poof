import type { User } from "firebase/auth";

export async function startAdminSession(user: User) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: user.refreshToken, freshSignIn: true }),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Could not start the administrator session.");
}

export async function restoreAdminSession(user: User) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: user.refreshToken, restore: true }),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Could not restore the administrator session.");
}

export async function endAdminSession() {
  const response = await fetch("/api/auth/session", { method: "DELETE", cache: "no-store" });
  if (!response.ok) throw new Error("Could not end the administrator session. Please try again.");
}
