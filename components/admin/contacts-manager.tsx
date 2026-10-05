"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, onSnapshot, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/sign-in";
import { endAdminSession } from "@/lib/admin-session";
import NotificationBell from "./notification-bell";

type Contact = { id: string; category?: "contact" | "prayer"; name: string; email: string; phone?: string; message: string; createdAt?: { toDate?: () => Date } | null };

export default function ContactsManager() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, (current) => { setUser(current); setReady(true); if (!current) setIsAdmin(false); }), []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const adminRef = doc(db, "admins", user.uid);
    getDoc(adminRef).then(async (snapshot) => {
      const expiresAt = snapshot.data()?.expiresAt?.toMillis?.() ?? 0;
      if (active) setIsAdmin(snapshot.exists() && snapshot.data()?.enabled === true && expiresAt > Date.now());
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not verify admin access."); });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(query(collection(db, "contacts")), (snapshot) => {
      setContacts(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Contact).sort((a, b) => (b.createdAt?.toDate?.().getTime() ?? 0) - (a.createdAt?.toDate?.().getTime() ?? 0)));
    }, (reason) => setError(reason.message));
  }, [isAdmin]);

  return <main className="admin-shell"><header className="admin-top"><a className="back-link" href="/admin">← Channel admin</a><span className="admin-mark">POOF <span>INBOX</span></span><div className="admin-top-actions"><NotificationBell user={user}/><a className="text-button" href="/contact" target="_blank">View contact page ↗</a><button className="text-button" onClick={() => void endAdminSession().finally(() => signOut(auth))}>Sign out</button></div></header>
    <div className="admin-content"><div className="admin-heading"><span className="eyebrow">INBOX</span><h1>Contact & prayer requests</h1><p>Messages and prayer requests submitted through the public forms.</p></div>
      {!ready ? <section className="admin-panel loading-card">Checking administrator access…</section> : !user || !isAdmin ? <section className="admin-panel sign-in-panel"><div className="panel-icon">◎</div><h2>{user ? "Admin access required" : "Administrator sign in"}</h2><p>{user ? "This Google account is not authorized to view contact messages." : "Sign in with your administrator Google account."}</p>{error && <p className="notice error-notice">{error}</p>}{!user && <button className="primary-button" onClick={() => void signInWithGoogle().catch((reason) => setError(reason instanceof Error ? reason.message : "Google sign-in failed."))}>Continue with Google</button>}</section> : <>
        <div className="channel-list-heading"><h2>Messages <span>{contacts.length}</span></h2></div>
        {error && <p className="notice error-notice">{error}</p>}
        {!contacts.length ? <section className="admin-panel empty-state"><h3>No submissions yet</h3><p>New contact messages and prayer requests will appear here.</p></section> : <div className="contact-admin-list">{contacts.map((item) => {
          const date = item.createdAt?.toDate?.();
          return <article className="admin-panel contact-admin-card" key={item.id}><header><div><span className="inbox-type">{item.category === "prayer" ? "PRAYER REQUEST" : "CONTACT MESSAGE"}</span><h2>{item.name}</h2><time>{date ? date.toLocaleString() : "Recently submitted"}</time></div><button className="icon-action remove-action" aria-label={`Delete message from ${item.name}`} onClick={() => { if (window.confirm(`Delete the submission from ${item.name}?`)) void deleteDoc(doc(db, "contacts", item.id)).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not delete submission.")); }}>×</button></header><p><a href={`mailto:${encodeURIComponent(item.email)}`}>{item.email}</a>{item.phone && <> · <a href={`tel:${encodeURIComponent(item.phone)}`}>{item.phone}</a></>}</p><div className="contact-message">{item.message}</div></article>;
        })}</div>}
      </>}
    </div>
  </main>;
}
