"use client";

import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { eventGroups, formatMeetingDate, formatMeetingTime, meetingJoinVisible, meetingSearchText, type EventStatus, type Meeting } from "@/lib/meetings";
import MeetingCountdown from "@/components/home/meeting-countdown";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";
import { MeetingListSkeleton } from "@/components/home/skeleton";

type StatusFilter = "all" | EventStatus;

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ongoing", label: "Ongoing" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

const emptyMessages: Record<EventStatus, string> = {
  ongoing: "No events are live right now.",
  upcoming: "No upcoming meetings scheduled.",
  completed: "Past meetings will appear here.",
};

function MeetingIcon({ name }: { name: "calendar" | "clock" | "arrow" | "search" }) {
  const props = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (name === "calendar") return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>;
  if (name === "clock") return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  if (name === "search") return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg>;
  return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
}

function MeetingCard({ meeting, status, now }: { meeting: Meeting; status: EventStatus; now: number }) {
  async function shareMeeting() {
    const url = `${window.location.origin}/meetings/${encodeURIComponent(meeting.id)}`;
    try {
      if (navigator.share) await navigator.share({ url });
      else await navigator.clipboard.writeText(url);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      try { await navigator.clipboard.writeText(url); } catch { /* Sharing is unavailable in this browser. */ }
    }
  }
  return <article className="zoom-meeting-card">
    {meeting.posterUrl && <div className="zoom-poster"><img src={meeting.posterUrl} alt={`${meeting.title} poster`}/></div>}
    <div className="zoom-meeting-copy"><span className={`meeting-status status-${status}`}>{status}</span><h2>{meeting.title}</h2>
      {meeting.description && <p>{meeting.description}</p>}
      <div className="zoom-meeting-meta"><span><MeetingIcon name="calendar"/>{formatMeetingDate(meeting.startsAt)}</span><span><MeetingIcon name="clock"/>{formatMeetingTime(meeting)}</span></div>
      <MeetingCountdown meeting={meeting}/>
      <p className="meeting-format">{meeting.meetingType === "onsite" ? `Onsite · ${meeting.venue ?? "Venue to be announced"}` : "Online"}</p>
      <div className="meeting-actions"><button className="meeting-share-button" type="button" onClick={() => void shareMeeting()} aria-label={`Share ${meeting.title}`} title="Share event"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.2"/></svg><span>Share</span></button>{meetingJoinVisible(meeting, now) && <a className="zoom-join-button" href={meeting.meetingUrl} target="_blank" rel="noreferrer">Join meeting <MeetingIcon name="arrow"/></a>}</div>
    </div>
  </article>;
}

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
  const groups = eventGroups(meetings, now);
  const matched = groups.map((group) => ({ ...group, meetings: term ? group.meetings.filter((item) => meetingSearchText(item).includes(term)) : group.meetings }));
  const counts: Record<StatusFilter, number> = { all: 0, ongoing: 0, upcoming: 0, completed: 0 };
  for (const group of matched) { counts[group.status] = group.meetings.length; counts.all += group.meetings.length; }
  const visibleGroups = statusFilter === "all"
    ? matched.filter((group) => group.status !== "ongoing" || group.meetings.length > 0)
    : matched.filter((group) => group.status === statusFilter);
  const filtering = Boolean(term) || statusFilter !== "all";
  const activeStatus = statusOptions.find((option) => option.value === statusFilter);
  const resultsLabel = filtering
    ? `${counts.all} ${counts.all === 1 ? "event" : "events"} ${term ? `matching “${search.trim()}”` : `${activeStatus?.label.toLowerCase()} only`}`
    : `${counts.all} ${counts.all === 1 ? "event" : "events"} scheduled`;

  return <main className="zoom-meetings-page">
    <header className="zoom-page-header"><Link href="/">&larr; Home</Link><span>MEETING SCHEDULE</span><h1>Zoom Meetings</h1><p>Join a live gathering or view upcoming and past meetings.</p></header>
    <div className="zoom-toolbar">
      <div className="zoom-search"><MeetingIcon name="search"/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setSearch(""); }} placeholder="Search events by title, topic, or venue" aria-label="Search events"/></div>
      <nav className="zoom-filter" aria-label="Filter events by status">{statusOptions.map((option) => <button key={option.value} type="button" className={statusFilter === option.value ? "active" : ""} aria-pressed={statusFilter === option.value} onClick={() => setStatusFilter(option.value)}>{option.label}<b>{counts[option.value]}</b></button>)}</nav>
    </div>
    {!loaded ? <section className="zoom-meeting-section"><h2>Meetings</h2><MeetingListSkeleton/></section> : <>
      <p className="zoom-results-count" role="status">{resultsLabel}</p>
      {visibleGroups.length ? visibleGroups.map((group) => <section className="zoom-meeting-section" key={group.status}><h2>{group.label}</h2>{group.meetings.length ? <div className="zoom-meeting-list">{group.meetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} status={group.status} now={now}/>)}</div> : <p className="zoom-empty">{emptyMessages[group.status]}</p>}</section>) : <p className="zoom-empty zoom-empty-filtered">No events match your search. Try another title, topic, or venue.</p>}
    </>}
    <MobileBottomNav current="meetings"/>
  </main>;
}
