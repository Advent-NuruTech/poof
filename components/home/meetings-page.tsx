"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { formatMeetingDate, formatMeetingTime, meetingStatus, type Meeting } from "@/lib/meetings";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";

function MeetingCard({ meeting, live }: { meeting: Meeting; live?: boolean }) {
  return <article className="zoom-meeting-card">
    {meeting.posterUrl && <div className="zoom-poster"><img src={meeting.posterUrl} alt={`${meeting.title} poster`}/></div>}
    <div className="zoom-meeting-copy">{live && <span className="zoom-live-label"><i/> Zoom meeting is live</span>}<h2>{meeting.title}</h2>
      {meeting.description && <p>{meeting.description}</p>}
      <div className="zoom-meeting-meta"><span>{formatMeetingDate(meeting.startsAt)}</span><span>{formatMeetingTime(meeting)}</span></div>
      {live && <a className="zoom-join-button" href={meeting.meetingUrl} target="_blank" rel="noreferrer">Join now â†—</a>}
    </div>
  </article>;
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);
  useEffect(() => onSnapshot(collection(db, "meetings"), (snapshot) => {
    setMeetings(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Meeting));
    setLoaded(true);
  }, () => setLoaded(true)), []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

  const live = meetings.filter((item) => meetingStatus(item, now) === "live");
  const upcoming = meetings.filter((item) => meetingStatus(item, now) === "upcoming").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = meetings.filter((item) => meetingStatus(item, now) === "past").sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return <main className="zoom-meetings-page">
    <header className="zoom-page-header"><a href="/">â† Home</a><span>POOF Â· ZOOM</span><h1>Zoom Meetings</h1><p>Join a live gathering or find details for whatâ€™s coming up.</p></header>
    {!loaded ? <p className="zoom-empty">Loading meetingsâ€¦</p> : <>
      {live.length > 0 && <section className="zoom-meeting-section"><h2>Live now</h2><div className="zoom-meeting-list">{live.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} live/>)}</div></section>}
      <section className="zoom-meeting-section"><h2>Upcoming</h2>{upcoming.length ? <div className="zoom-meeting-list">{upcoming.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting}/>)}</div> : <p className="zoom-empty">No upcoming meetings scheduled.</p>}</section>
      <section className="zoom-meeting-section"><h2>Meeting history</h2>{past.length ? <div className="zoom-meeting-list">{past.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting}/>)}</div> : <p className="zoom-empty">Past meetings will appear here.</p>}</section>
    </>}
    <MobileBottomNav current="meetings"/>
  </main>;
}
