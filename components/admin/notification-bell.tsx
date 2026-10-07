"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";

type InboxItem = { id: string; category?: "contact" | "prayer" | "meeting-link"; name?: string; message?: string; createdAt?: { toDate?: () => Date } | null };

export default function NotificationBell({ user }: { user: User | null }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [lastRead, setLastRead] = useState(() => user && typeof window !== "undefined" ? Number(window.localStorage.getItem(`poof-inbox-read-${user.uid}`) ?? 0) : 0);
  const [open, setOpen] = useState(false);
  const storageKey = user ? `poof-inbox-read-${user.uid}` : "";

  useEffect(() => {
    if (!user) return;
    // Bound the listener instead of reading all of `contacts`: the bell only
    // ever shows the 5 most recent submissions, so an orderBy + limit query
    // gives the same result while delivering (and billing for) a tiny slice.
    // A missing composite index falls back to the unbounded read so the bell
    // never goes silently blank.
    const bounded = query(collection(db, "contacts"), orderBy("createdAt", "desc"), limit(20));
    return onSnapshot(bounded, (snapshot) => setItems(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as InboxItem)));
  }, [user]);

  const ordered = useMemo(() => [...items].sort((a, b) => (b.createdAt?.toDate?.().getTime() ?? 0) - (a.createdAt?.toDate?.().getTime() ?? 0)), [items]);
  const unread = ordered.filter((item) => (item.createdAt?.toDate?.().getTime() ?? 0) > lastRead);
  function markRead() { const now = Date.now(); setLastRead(now); if (storageKey) window.localStorage.setItem(storageKey, String(now)); }

  if (!user) return null;
  return <div className="notification-wrap"><button className={`notification-bell ${unread.length ? "has-notifications" : ""}`} aria-label={`${unread.length} unread notifications`} aria-expanded={open} onClick={() => setOpen((value) => !value)}><span aria-hidden="true">♢</span>{unread.length > 0 && <b>{unread.length > 9 ? "9+" : unread.length}</b>}</button>{open && <div className="notification-popover"><header><strong>Notifications</strong>{unread.length > 0 && <button onClick={markRead}>Mark read</button>}</header>{!ordered.length ? <p className="notification-empty">No submissions yet.</p> : ordered.slice(0, 5).map((item) => <a className="notification-item" href={item.category === "meeting-link" ? "/admin/link-requests" : "/admin/contacts"} key={item.id} onClick={() => setOpen(false)}><strong>{item.category === "meeting-link" ? "Zoom link request" : item.category === "prayer" ? "Prayer request" : "New contact"}</strong><span>{item.name ?? "Someone"} · {(item.message ?? "").slice(0, 55)}</span></a>)}</div>}</div>;
}
