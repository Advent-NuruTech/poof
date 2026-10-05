"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";

const INITIAL_ADMIN_UID = "3H3BclyO2FePQ59KYIO2kKSirnx2";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, (current) => {
    setUser(current);
    setReady(!current);
    setAuthorized(false);
    setError("");
  }), []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const verify = async () => {
      try {
        const adminRef = doc(db, "admins", user.uid);
        let snapshot = await getDoc(adminRef);
        if (!snapshot.exists() && user.uid === INITIAL_ADMIN_UID) {
          await setDoc(adminRef, { enabled: true });
          snapshot = await getDoc(adminRef);
        }
        if (active) setAuthorized(snapshot.exists() && snapshot.data()?.enabled === true);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not verify administrator access.");
      } finally {
        if (active) setReady(true);
      }
    };
    void verify();
    return () => { active = false; };
  }, [user]);

  if (!ready) return <main className="loading-card">Checking administrator access…</main>;
  if (!user || !authorized) return <main className="sign-in-panel admin-panel">
    <div className="panel-icon">◉</div>
    <h2>{user ? "Admin access required" : "Administrator sign in"}</h2>
    <p>{user ? "This account is not authorized to view administrator pages." : "Sign in with your administrator Google account to continue."}</p>
    {error && <p className="notice error-notice">{error}</p>}
    {!user && <a className="primary-button" href="/signin">Go to sign in</a>}
  </main>;
  return children;
}
