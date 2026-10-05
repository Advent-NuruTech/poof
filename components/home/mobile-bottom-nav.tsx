"use client";

import type { ReactNode } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { meetingStatus, type Meeting } from "@/lib/meetings";

type Section = "home" | "library" | "meetings" | "contact";

const tabs: { section: Section; label: string; href: string; icon: ReactNode }[] = [
  { section: "home", label: "Home", href: "/", icon: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" fill="currentColor" stroke="none"/> },
  { section: "library", label: "Library", href: "/library", icon: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 6h13M8 8v6"/></> },
  { section: "meetings", label: "Zoom", href: "/meetings", icon: <><rect x="3" y="7" width="18" height="13" rx="3"/><path d="m8 7 1.5-3h5L16 7M12 11v5m-2.5-2.5h5"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/></> },
  { section: "contact", label: "Contact", href: "/contact", icon: <><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.7-3.5 3.3-5.5 7.5-5.5s6.8 2 7.5 5.5"/></> },
];

export default function MobileBottomNav({ current }: { current: Section }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [now, setNow] = useState(0);
  useEffect(() => onSnapshot(collection(db, "meetings"), (snapshot) => {
    setMeetings(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Meeting));
  }, () => setMeetings([])), []);
  useEffect(() => { const initial = window.setTimeout(() => setNow(Date.now()), 0); const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, []);
  const meetingCount = meetings.filter((meeting) => meetingStatus(meeting, now) !== "completed").length;
  return <nav className="mobile-tabbar" aria-label="Main navigation">
    {tabs.map((tab) => <a key={tab.section} className={current === tab.section ? "tab-active" : ""} href={tab.href} aria-current={current === tab.section ? "page" : undefined}>
      <span className="tab-icon-wrap"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{tab.icon}</svg>{tab.section === "meetings" && meetingCount > 0 && <span className="tab-count" aria-label={`${meetingCount} upcoming or ongoing meetings`}>{meetingCount > 9 ? "9+" : meetingCount}</span>}</span>
      <span>{tab.label}</span>
    </a>)}
  </nav>;
}
