"use client";

import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { formatMeetingDate, formatMeetingTime, meetingJoinVisible, meetingStatus, type Meeting } from "@/lib/meetings";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";
import { MeetingListSkeleton } from "@/components/home/skeleton";

function MeetingIcon({ name }: { name: "calendar" | "clock" | "arrow" }) {
  const props = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (name === "calendar") return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>;
  if (name === "clock") return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
}

function MeetingCard({ meeting, status, now }: { meeting: Meeting; status: string; now: number }) {
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
      <p className="meeting-format">{meeting.meetingType === "onsite" ? `Onsite · ${meeting.venue ?? "Venue to be announced"}` : "Online"}</p>
      <div className="meeting-actions"><button className="meeting-share-button" type="button" onClick={() => void shareMeeting()} aria-label={`Share ${meeting.title}`} title="Share event"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.2"/></svg><span>Share</span></button>{meetingJoinVisible(meeting, now) && <a className="zoom-join-button" href={meeting.meetingUrl} target="_blank" rel="noreferrer">Join meeting <MeetingIcon name="arrow"/></a>}</div>
    </div>
  </article>;
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [now, setNow] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => onSnapshot(collection(db, "meetings"), (snapshot) => {
    setMeetings(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Meeting));
    setLoaded(true);
  }, () => setLoaded(true)), []);
  useEffect(() => { const initial = window.setTimeout(() => setNow(Date.now()), 0); const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, []);

  const live = meetings.filter((item) => meetingStatus(item, now) === "ongoing");
  const upcoming = meetings.filter((item) => meetingStatus(item, now) === "upcoming").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = meetings.filter((item) => meetingStatus(item, now) === "completed").sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return <main className="zoom-meetings-page">
    <header className="zoom-page-header"><Link href="/">&larr; Home</Link><span>MEETING SCHEDULE</span><h1>Zoom Meetings</h1><p>Join a live gathering or view upcoming and past meetings.</p></header>
    {!loaded ? <section className="zoom-meeting-section"><h2>Meetings</h2><MeetingListSkeleton/></section> : <>
      {live.length > 0 && <section className="zoom-meeting-section"><h2>Ongoing</h2><div className="zoom-meeting-list">{live.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} status="ongoing" now={now}/>)}</div></section>}
      <section className="zoom-meeting-section"><h2>Upcoming</h2>{upcoming.length ? <div className="zoom-meeting-list">{upcoming.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} status="upcoming" now={now}/>)}</div> : <p className="zoom-empty">No upcoming meetings scheduled.</p>}</section>
      <section className="zoom-meeting-section"><h2>Completed</h2>{past.length ? <div className="zoom-meeting-list">{past.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} status="completed" now={now}/>)}</div> : <p className="zoom-empty">Past meetings will appear here.</p>}</section>
    </>}
    <MobileBottomNav current="meetings"/>
  </main>;
}
