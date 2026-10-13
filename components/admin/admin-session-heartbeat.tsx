"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export default function AdminSessionHeartbeat() {
  const router = useRouter();

  useEffect(() => {
    let lastRefresh = 0;
    let refreshing = false;

    async function refreshSession() {
      if (refreshing || Date.now() - lastRefresh < REFRESH_INTERVAL_MS) return;
      refreshing = true;
      try {
        const response = await fetch("/api/auth/session", { method: "PATCH", cache: "no-store" });
        if (response.status === 401) {
          router.replace("/signin?next=%2Fpoof%2Fadmin");
          return;
        }
        if (!response.ok) {
          console.error("Admin session activity could not be renewed", response.status, await response.text());
          return;
        }
        lastRefresh = Date.now();
      } catch (reason) {
        console.error("Admin session activity could not be renewed", reason);
      } finally {
        refreshing = false;
      }
    }

    const onActivity = () => { void refreshSession(); };
    void refreshSession();
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity, { passive: true });
    window.addEventListener("scroll", onActivity, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("scroll", onActivity);
    };
  }, [router]);

  return null;
}
