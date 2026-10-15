"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const ADMIN_APP_SHORTCUT_KEY = "poof-admin-app-shortcut";
const AdminAppShortcutContext = createContext(false);

export function useAdminAppShortcutVisible() {
  return useContext(AdminAppShortcutContext);
}

export default function AdminAppAccessProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [showAdminShortcut, setShowAdminShortcut] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && navigator.standalone === true);
    if (!standalone) return;

    let active = true;
    let previouslyVerified = false;
    try {
      previouslyVerified = localStorage.getItem(ADMIN_APP_SHORTCUT_KEY) === "true";
    } catch (reason) {
      console.error("Saved administrator app access could not be read.", reason);
    }

    if (previouslyVerified) {
      window.setTimeout(() => {
        if (active) setShowAdminShortcut(true);
      }, 0);
    }

    void fetch("/api/auth/session", {
      method: "PATCH",
      cache: "no-store",
    }).then((response) => {
      if (!active) return;
      if (response.ok) {
        try {
          localStorage.setItem(ADMIN_APP_SHORTCUT_KEY, "true");
        } catch (reason) {
          console.error("Administrator shortcut preference could not be saved.", reason);
        }
        setShowAdminShortcut(true);
      } else if (response.status === 401) {
        try {
          localStorage.removeItem(ADMIN_APP_SHORTCUT_KEY);
        } catch (reason) {
          console.error("Expired administrator shortcut preference could not be cleared.", reason);
        }
        setShowAdminShortcut(false);
      } else {
        console.error("Administrator app access could not be verified.", response.status);
      }
    }).catch((reason: unknown) => {
      if (active) console.error("Administrator app access could not be verified online.", reason);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminAppShortcutContext.Provider value={showAdminShortcut}>
      {children}
    </AdminAppShortcutContext.Provider>
  );
}
