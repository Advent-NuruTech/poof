"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getCountFromServer, getDoc, limit, query } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { meetingGroups, type Meeting } from "@/lib/meetings";
import type { PublicCatalogFeed } from "@/lib/catalog-feed-types";

type Totals = { videos: number; playlists: number; channels: number; requests: number; studies: number };
const initialTotals: Totals = { videos: 0, playlists: 0, channels: 0, requests: 0, studies: 0 };

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authorizationChecked, setAuthorizationChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [totals, setTotals] = useState(initialTotals);
  const [publicMeetings, setPublicMeetings] = useState<Meeting[]>([]);
  const [meetingFeedReady, setMeetingFeedReady] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);

  // Admin state is reset from the auth callback, never synchronously in an effect.
  useEffect(() => onAuthStateChanged(auth, (current) => { setUser(current); setAuthReady(true); setAuthorizationChecked(false); setAuthorized(false); }), []);
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
      if (active) { setAuthorized(enabled); setAuthorizationChecked(true); }
    }).catch((reason) => { if (active) { setError(reason instanceof Error ? reason.message : "Could not verify administrator access."); setAuthorizationChecked(true); } });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (!authorized) return;
    let active = true;
    Promise.all([
      getCountFromServer(collection(db, "videos")),
      getCountFromServer(query(collection(db, "contacts"), limit(100))),
      getCountFromServer(query(collection(db, "libraryDocuments"), limit(900))),
      getCountFromServer(collection(db, "playlists")),
      getCountFromServer(collection(db, "channels")),
    ]).then(([videos, requests, studies, playlists, channels]) => {
      if (active) setTotals({ videos: videos.data().count, requests: requests.data().count, studies: studies.data().count, playlists: playlists.data().count, channels: channels.data().count });
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load dashboard totals."); });
    return () => { active = false; };
  }, [authorized]);
  useEffect(() => {
    if (!authorized) return;
    let active = true;
    fetch("/api/catalog", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the public meeting schedule.");
        return await response.json() as PublicCatalogFeed;
      })
      .then((feed) => {
        if (active) {
          setPublicMeetings(feed.meetings);
          setMeetingFeedReady(true);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load the public meeting schedule.");
      });
    return () => { active = false; };
  }, [authorized]);

  const meetingCounts = useMemo(() => {
    const counts = { ongoing: 0, upcoming: 0, completed: 0 };
    for (const group of meetingGroups(publicMeetings, now)) counts[group.status] = group.meetings.length;
    return counts;
  }, [publicMeetings, now]);
  const meetingTotal = meetingCounts.ongoing + meetingCounts.upcoming + meetingCounts.completed;
  const cards = [
    { label: "Total videos", value: totals.videos, href: "/admin/channels", icon: "▶", note: "Manage synced videos" },
    { label: "Playlists", value: totals.playlists, href: "/admin/channels", icon: "▤", note: "Manage synced playlists" },
    { label: "YouTube channels", value: totals.channels, href: "/admin/channels", icon: "◉", note: "Manage connected sources" },
    { label: "Prayer & contact requests", value: totals.requests, href: "/admin/contacts", icon: "✉", note: "Review the inbox" },
    { label: "Total studies", value: totals.studies, href: "/admin/library", icon: "▤", note: "Manage study library" },
  ];
  const meetingCards = [
    { label: "Total meetings", value: meetingTotal, href: "/admin/meetings", icon: "◷", note: "Shown on the public schedule" },
    { label: "Ongoing", value: meetingCounts.ongoing, href: "/admin/meetings", icon: "●", note: "Happening now" },
    { label: "Upcoming", value: meetingCounts.upcoming, href: "/admin/meetings", icon: "↗", note: "Scheduled ahead" },
    { label: "Completed", value: meetingCounts.completed, href: "/admin/meetings", icon: "✓", note: "Recently completed" },
  ];

  return <main className="admin-dashboard">
    <header className="dashboard-heading">
      <span className="eyebrow">ADMIN WORKSPACE</span>
      <h1>Dashboard</h1>
      <p>A clear overview of your content, channels, inbox, and public meeting schedule.</p>
    </header>
    {error && <p className="notice error-notice">{error}</p>}
    {!authReady ? <section className="admin-panel dashboard-loading">Checking your workspace…</section> : !user ? <section className="admin-panel dashboard-access"><h2>Administrator sign in</h2><p>Sign in with your administrator account to view workspace totals.</p><Link className="primary-button" href="/signin">Sign in</Link></section> : !authorizationChecked ? <section className="admin-panel dashboard-loading">Verifying administrator access…</section> : !authorized ? <section className="admin-panel dashboard-access"><h2>Admin access required</h2><p>This account is not authorized to view workspace totals.</p><Link className="outline-button" href="/signin">Switch account</Link></section> : <>
      <section className="dashboard-section" aria-label="Content summary">
        <div className="dashboard-section-heading"><div><span className="eyebrow">OVERVIEW</span><h2>Content & channels</h2></div><Link href="/admin/channels">Manage channels <span aria-hidden="true">→</span></Link></div>
        <div className="dashboard-grid">{cards.map((card) => <Link className="dashboard-card" href={card.href} key={card.label}>
          <span className="dashboard-card-icon" aria-hidden="true">{card.icon}</span>
          <span className="dashboard-card-label">{card.label}</span>
          <strong>{card.value.toLocaleString()}</strong>
          <span className="dashboard-card-note">{card.note}<span aria-hidden="true"> →</span></span>
        </Link>)}</div>
      </section>
      <section className="dashboard-section" aria-label="Public meeting schedule summary">
        <div className="dashboard-section-heading"><div><span className="eyebrow">PUBLIC SCHEDULE</span><h2>Meetings</h2></div><Link href="/admin/meetings">Manage meetings <span aria-hidden="true">→</span></Link></div>
        <p className="dashboard-section-note">Counts match the public schedule, including visible occurrences of repeating meetings.</p>
        <div className="dashboard-grid dashboard-meeting-grid">{meetingCards.map((card) => <Link className="dashboard-card" href={card.href} key={card.label}>
          <span className="dashboard-card-icon" aria-hidden="true">{card.icon}</span>
          <span className="dashboard-card-label">{card.label}</span>
          <strong>{meetingFeedReady ? card.value.toLocaleString() : "—"}</strong>
          <span className="dashboard-card-note">{card.note}<span aria-hidden="true"> →</span></span>
        </Link>)}</div>
      </section>
      <section className="dashboard-shortcuts" aria-label="Admin shortcuts">
        <Link href="/admin/link-requests"><span aria-hidden="true">↗</span><span><strong>Meeting link requests</strong><small>Review requests for Zoom links</small></span><b aria-hidden="true">→</b></Link>
        <Link href="/admin/contacts"><span aria-hidden="true">✉</span><span><strong>Contact & prayer inbox</strong><small>Read and respond to submissions</small></span><b aria-hidden="true">→</b></Link>
      </section>
    </>}
  </main>;
}
