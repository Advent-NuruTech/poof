"use client";

import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { meetingGroups, meetingSearchText, type Meeting, type MeetingStatus } from "@/lib/meetings";
import MeetingCard, { MeetingIcon } from "@/components/home/meeting-card";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";
import { MeetingListSkeleton } from "@/components/home/skeleton";

type StatusFilter = "all" | MeetingStatus;

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ongoing", label: "Ongoing" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

const emptyMessages: Record<MeetingStatus, string> = {
  ongoing: "No meetings are live right now.",
  upcoming: "No upcoming meetings scheduled.",
  completed: "Past meetings will appear here.",
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [now, setNow] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  useEffect(() => onSnapshot(collection(db, "meetings"), (snapshot) => {
    setMeetings(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Meeting));
    setLoaded(true);
  }, () => setLoaded(true)), []);
  useEffect(() => { const initial = window.setTimeout(() => setNow(Date.now()), 0); const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, []);

  const term = search.trim().toLowerCase();
  const groups = meetingGroups(meetings, now);
  const matched = groups.map((group) => ({ ...group, meetings: term ? group.meetings.filter((item) => meetingSearchText(item).includes(term)) : group.meetings }));
  const counts: Record<StatusFilter, number> = { all: 0, ongoing: 0, upcoming: 0, completed: 0 };
  for (const group of matched) { counts[group.status] = group.meetings.length; counts.all += group.meetings.length; }
  const visibleGroups = statusFilter === "all"
    ? matched.filter((group) => group.status !== "ongoing" || group.meetings.length > 0)
    : matched.filter((group) => group.status === statusFilter);
  const filtering = Boolean(term) || statusFilter !== "all";
  const activeLabel = statusOptions.find((option) => option.value === statusFilter)?.label.toLowerCase() ?? "";
  const resultsLabel = filtering
    ? `${counts.all} ${counts.all === 1 ? "meeting" : "meetings"} ${term ? `matching “${search.trim()}”` : `${activeLabel} only`}`
    : `${counts.all} ${counts.all === 1 ? "meeting" : "meetings"} scheduled`;

  return <main className="zoom-meetings-page">
    <header className="zoom-page-header"><Link href="/">&larr; Home</Link><span>MEETING SCHEDULE</span><h1>Zoom Meetings</h1><p>Join a live gathering or view upcoming and past meetings.</p></header>
    <div className="zoom-toolbar">
      <div className="zoom-search"><MeetingIcon name="search"/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setSearch(""); }} placeholder="Search meetings by title, topic, or venue" aria-label="Search meetings"/></div>
      <nav className="zoom-filter" aria-label="Filter meetings by status">{statusOptions.map((option) => <button key={option.value} type="button" className={statusFilter === option.value ? "active" : ""} aria-pressed={statusFilter === option.value} onClick={() => setStatusFilter(option.value)}>{option.label}<b>{counts[option.value]}</b></button>)}</nav>
    </div>
    {!loaded ? <section className="zoom-meeting-section"><h2>Meetings</h2><MeetingListSkeleton/></section> : <>
      <p className="zoom-results-count" role="status">{resultsLabel}</p>
      {visibleGroups.length ? visibleGroups.map((group) => <section className="zoom-meeting-section" key={group.status}><h2>{group.label}</h2>{group.meetings.length ? <div className="zoom-meeting-list">{group.meetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} now={now}/>)}</div> : <p className="zoom-empty">{emptyMessages[group.status]}</p>}</section>) : <p className="zoom-empty zoom-empty-filtered">No meetings match your search. Try another title, topic, or venue.</p>}
    </>}
    <MobileBottomNav current="meetings"/>
  </main>;
}
