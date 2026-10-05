"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";

type InboxItem = { id: string; category?: "contact" | "prayer"; name?: string; message?: string; createdAt?: { toDate?: () => Date } | null };

export default function NotificationBell({ user }: { user: User | null }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [lastRead, setLastRead] = useState(() => user && typeof window !== "undefined" ? Number(window.localStorage.getItem(`poof-inbox-read-${user.uid}`) ?? 0) : 0);
  const [open, setOpen] = useState(false);
  const storageKey = user ? `poof-inbox-read-${user.uid}` : "";

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "contacts"), (snapshot) => setItems(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as InboxItem)));
  }, [user]);

  const ordered = useMemo(() => [...items].sort((a, b) => (b.createdAt?.toDate?.().getTime() ?? 0) - (a.createdAt?.toDate?.().getTime() ?? 0)), [items]);
  const unread = ordered.filter((item) => (item.createdAt?.toDate?.().getTime() ?? 0) > lastRead);
  function markRead() { const now = Date.now(); setLastRead(now); if (storageKey) window.localStorage.setItem(storageKey, String(now)); }

  if (!user) return null;
  return <div className="notification-wrap"><button className={`notification-bell ${unread.length ? "has-notifications" : ""}`} aria-label={`${unread.length} unread notifications`} aria-expanded={open} onClick={() => setOpen((value) => !value)}><span aria-hidden="true">♢</span>{unread.length > 0 && <b>{unread.length > 9 ? "9+" : unread.length}</b>}</button>{open && <div className="notification-popover"><header><strong>Notifications</strong>{unread.length > 0 && <button onClick={markRead}>Mark read</button>}</header>{!ordered.length ? <p className="notification-empty">No submissions yet.</p> : ordered.slice(0, 5).map((item) => <a className="notification-item" href="/admin/contacts" key={item.id} onClick={() => setOpen(false)}><strong>{item.category === "prayer" ? "Prayer request" : "New contact"}</strong><span>{item.name ?? "Someone"} · {(item.message ?? "").slice(0, 55)}</span></a>)}</div>}</div>;
}
