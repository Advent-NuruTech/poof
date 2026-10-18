"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { isAdminIdentity } from "@/lib/admin-access";
import NotificationBell from "./notification-bell";

type Category = "contact" | "prayer" | "meeting-link";
type Status = "pending" | "handled";
type Contact = { id: string; category?: Category; status?: Status; name: string; email: string; phone?: string; message: string; createdAt?: { toDate?: () => Date } | null; handledAt?: { toDate?: () => Date } | null };

const tabs: { id: Category; label: string }[] = [
  { id: "contact", label: "Contact" },
  { id: "prayer", label: "Prayer Request" },
  { id: "meeting-link", label: "Zoom Link Request" },
];
const statusFilters: { id: Status | "all"; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "handled", label: "Handled" },
  { id: "all", label: "All" },
];

export default function ContactsManager({ mode = "all", initialTab = "contact" }: { mode?: "all" | "meeting-link"; initialTab?: Category }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tab, setTab] = useState<Category>(mode === "meeting-link" ? "meeting-link" : initialTab);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("pending");
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, (current) => { setUser(current); setReady(true); if (!current) setIsAdmin(false); }), []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    getDoc(doc(db, "admins", user.uid)).then((snapshot) => {
      const admin = snapshot.data();
      if (active) setIsAdmin(snapshot.exists() && isAdminIdentity(user.uid, {
        enabled: admin?.enabled,
        expiresAt: admin?.expiresAt?.toMillis?.() ?? 0,
        inviteId: admin?.inviteId,
        codeHash: admin?.codeHash,
      }));
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not verify admin access."); });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    void getDocs(query(collection(db, "contacts"), limit(100))).then((snapshot) => {
      if (active) setContacts(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Contact).sort((a, b) => (b.createdAt?.toDate?.().getTime() ?? 0) - (a.createdAt?.toDate?.().getTime() ?? 0)));
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load submissions."); });
    return () => { active = false; };
  }, [isAdmin]);

  const setStatus = (item: Contact, status: Status) => {
    void updateDoc(doc(db, "contacts", item.id), { status, handledAt: status === "handled" ? new Date() : null }).then(() => setContacts((items) => items.map((entry) => entry.id === item.id ? { ...entry, status, handledAt: status === "handled" ? { toDate: () => new Date() } : null } : entry)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not update submission status."));
  };
  const tabContacts = contacts.filter((item) => (item.category ?? "contact") === tab);
  const visible = tabContacts.filter((item) => statusFilter === "all" || (item.status ?? "pending") === statusFilter);
  const countFor = (category: Category, status: Status | "all") => contacts.filter((item) => (item.category ?? "contact") === category && (status === "all" || (item.status ?? "pending") === status)).length;
  const title = mode === "meeting-link" ? "Zoom link requests" : "Contact & prayer requests";
  const activeTab = tabs.find((entry) => entry.id === tab) ?? tabs[0];
  const emptyCopy = statusFilter === "handled"
    ? `No ${activeTab.label.toLowerCase()} submissions have been marked as handled yet.`
    : statusFilter === "pending"
      ? `No pending ${activeTab.label.toLowerCase()} submissions right now.`
      : `No ${activeTab.label.toLowerCase()} submissions yet.`;
  return <main className="admin-shell"><header className="admin-top"><a className="back-link" href="/poof/admin">← Channel admin</a><span className="admin-mark">POOF <span>INBOX</span></span><div className="admin-top-actions"><NotificationBell user={user}/><a className="text-button" href={mode === "meeting-link" ? "/meeting-link-request" : "/contact"} target="_blank">View public form ↗</a></div></header>
    <div className="admin-content"><div className="admin-heading"><span className="eyebrow">INBOX</span><h1>{title}</h1><p>{mode === "meeting-link" ? "Review requests from visitors who would like to join an upcoming Zoom meeting." : "Messages, prayer requests, and Zoom link requests submitted through the public forms."}</p></div>
      {!ready ? <section className="admin-panel loading-card">Checking administrator access...</section> : !user || !isAdmin ? <section className="admin-panel sign-in-panel"><div className="panel-icon">◉</div><h2>{user ? "Admin access required" : "Administrator sign in"}</h2><p>{user ? "This account is not authorized to view these messages." : "Sign in with your administrator email and password."}</p>{error && <p className="notice error-notice">{error}</p>}<Link className="primary-button" href="/signin">Sign in</Link></section> : <>
        <div className="inbox-tabs" role="tablist" aria-label="Inbox categories">{tabs.map((entry) => <button key={entry.id} type="button" role="tab" aria-selected={tab === entry.id} className={`inbox-tab${tab === entry.id ? " is-active" : ""}`} onClick={() => setTab(entry.id)}>{entry.label}<span className="inbox-tab-count">{countFor(entry.id, "all")}</span></button>)}</div>
        <div className="inbox-filter" role="group" aria-label="Filter by status">{statusFilters.map((entry) => <button key={entry.id} type="button" aria-pressed={statusFilter === entry.id} className={`inbox-filter-button${statusFilter === entry.id ? " is-active" : ""}`} onClick={() => setStatusFilter(entry.id)}>{entry.label}<span className="inbox-tab-count">{countFor(tab, entry.id)}</span></button>)}</div>
        <div className="channel-list-heading"><h2>{activeTab.label} <span>{visible.length}</span></h2><span>{statusFilter === "all" ? "Showing every submission" : statusFilter === "pending" ? "Awaiting a response" : "Already handled"}</span></div>
        {error && <p className="notice error-notice">{error}</p>}
        {!visible.length ? <section className="admin-panel empty-state"><h3>Nothing here</h3><p>{emptyCopy}</p></section> : <div className="contact-admin-list">{visible.map((item) => {
          const date = item.createdAt?.toDate?.();
          const handled = (item.status ?? "pending") === "handled";
          const label = item.category === "meeting-link" ? "ZOOM LINK REQUEST" : item.category === "prayer" ? "PRAYER REQUEST" : "CONTACT MESSAGE";
          return <article className={`admin-panel contact-admin-card${handled ? " is-handled" : ""}`} key={item.id}><header><div><span className="inbox-type">{label}</span><h2>{item.name}</h2><time>{date ? date.toLocaleString() : "Recently submitted"}</time></div><div className="contact-card-actions"><span className={`inbox-status${handled ? " is-handled" : " is-pending"}`}>{handled ? "Handled" : "Pending"}</span><button className="icon-action remove-action" aria-label={`Delete message from ${item.name}`} onClick={() => { if (window.confirm(`Delete the submission from ${item.name}?`)) void deleteDoc(doc(db, "contacts", item.id)).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not delete submission.")); }}>×</button></div></header><p><a href={`mailto:${encodeURIComponent(item.email)}`}>{item.email}</a>{item.phone && <> · <a href={`tel:${encodeURIComponent(item.phone)}`}>{item.phone}</a></>}</p><div className="contact-message">{item.message}</div><div className="contact-card-footer"><button type="button" className="outline-button" onClick={() => setStatus(item, handled ? "pending" : "handled")}>{handled ? "Mark as pending" : "Mark as handled"}</button></div></article>;
        })}</div>}
      </>}
    </div>
  </main>;
}
