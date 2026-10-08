"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getCountFromServer, getDoc, limit, onSnapshot, query } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { meetingStatus, type Meeting } from "@/lib/meetings";

type Totals = { videos: number; requests: number; studies: number; meetings: { ongoing: number; upcoming: number; completed: number } };
const initialTotals: Totals = { videos: 0, requests: 0, studies: 0, meetings: { ongoing: 0, upcoming: 0, completed: 0 } };

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [totals, setTotals] = useState(initialTotals);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);

  // Admin state is reset from the auth callback, never synchronously in an effect.
  useEffect(() => onAuthStateChanged(auth, (current) => { setUser(current); if (!current) setAuthorized(false); }), []);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    getDoc(doc(db, "admins", user.uid)).then((snapshot) => {
      const data = snapshot.data();
      const enabled = snapshot.exists() && data?.enabled === true && (data?.expiresAt?.toMillis?.() ?? 0) > Date.now();
      if (active) setAuthorized(enabled);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not verify administrator access."); });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (!authorized) return;
    let active = true;
    Promise.all([
      getCountFromServer(collection(db, "videos")),
      getCountFromServer(query(collection(db, "contacts"), limit(100))),
      getCountFromServer(query(collection(db, "libraryDocuments"), limit(900))),
    ]).then(([videos, requests, studies]) => {
      if (active) setTotals((current: Totals) => ({ ...current, videos: videos.data().count, requests: requests.data().count, studies: studies.data().count }));
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load dashboard totals."); });
    return () => { active = false; };
  }, [authorized]);
  useEffect(() => {
    if (!authorized) return;
    return onSnapshot(query(collection(db, "meetings"), limit(200)), (snapshot) => {
      const counts = { ongoing: 0, upcoming: 0, completed: 0 };
      for (const item of snapshot.docs) counts[meetingStatus(item.data() as Meeting, now)] += 1;
      setTotals((current: Totals) => ({ ...current, meetings: counts }));
    }, (reason) => setError(reason.message));
  }, [authorized, now]);

  const meetingTotal = useMemo(() => totals.meetings.ongoing + totals.meetings.upcoming + totals.meetings.completed, [totals.meetings]);
  const cards = [
    { label: "Total videos", value: totals.videos, href: "/admin", icon: "▶", note: "Manage synced videos" },
    { label: "Prayer & contact requests", value: totals.requests, href: "/admin/contacts", icon: "✉", note: "Review the inbox" },
    { label: "Total studies", value: totals.studies, href: "/admin/library", icon: "▤", note: "Manage study library" },
  ];
  const meetingCards = [
    { label: "Total meetings", value: meetingTotal, href: "/admin/meetings", icon: "◷", note: "Manage all meetings" },
    { label: "Ongoing", value: totals.meetings.ongoing, href: "/admin/meetings", icon: "●", note: "Happening now" },
    { label: "Upcoming", value: totals.meetings.upcoming, href: "/admin/meetings", icon: "↗", note: "Scheduled ahead" },
    { label: "Completed", value: totals.meetings.completed, href: "/admin/meetings", icon: "✓", note: "Past meetings" },
  ];

  return <main className="admin-dashboard">
    <header className="dashboard-heading"><span className="eyebrow">ADMIN WORKSPACE</span><h1>Dashboard</h1><p>A quick overview of your videos, requests, studies, and meetings.</p></header>
    {error && <p className="notice error-notice">{error}</p>}
    {!authorized ? <section className="admin-panel dashboard-loading">Loading your workspace…</section> : <>
      <section className="dashboard-section" aria-label="Content summary"><div className="dashboard-grid">{cards.map((card) => <Link className="dashboard-card" href={card.href} key={card.label}><span className="dashboard-card-icon" aria-hidden="true">{card.icon}</span><span className="dashboard-card-label">{card.label}</span><strong>{card.value.toLocaleString()}</strong><span className="dashboard-card-note">{card.note}<span aria-hidden="true"> →</span></span></Link>)}</div></section>
      <section className="dashboard-section"><div className="dashboard-section-heading"><div><span className="eyebrow">SCHEDULE</span><h2>Meetings</h2></div><Link href="/admin/meetings">Manage meetings <span aria-hidden="true">→</span></Link></div><div className="dashboard-grid dashboard-meeting-grid">{meetingCards.map((card) => <Link className="dashboard-card" href={card.href} key={card.label}><span className="dashboard-card-icon" aria-hidden="true">{card.icon}</span><span className="dashboard-card-label">{card.label}</span><strong>{card.value.toLocaleString()}</strong><span className="dashboard-card-note">{card.note}<span aria-hidden="true"> →</span></span></Link>)}</div></section>
      <section className="dashboard-shortcuts"><Link href="/admin/link-requests"><span aria-hidden="true">↗</span><span><strong>Meeting link requests</strong><small>Review requests for Zoom links</small></span><b aria-hidden="true">→</b></Link><Link href="/admin/contacts"><span aria-hidden="true">✉</span><span><strong>Contact & prayer inbox</strong><small>Read and respond to submissions</small></span><b aria-hidden="true">→</b></Link></section>
    </>}
  </main>;
}
