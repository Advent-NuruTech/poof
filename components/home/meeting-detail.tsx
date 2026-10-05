"use client";

import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";
import { db } from "@/lib/firebase";
import { formatMeetingDate, formatMeetingTime, meetingJoinVisible, meetingStatus, type Meeting } from "@/lib/meetings";
import MeetingCountdown from "@/components/home/meeting-countdown";

export default function MeetingDetail({ id }: { id: string }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => onSnapshot(doc(db, "meetings", id), (snapshot) => {
    setMeeting(snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as Meeting) : null);
  }, () => setMeeting(null)), [id]);
  useEffect(() => { const initial = window.setTimeout(() => setNow(Date.now()), 0); const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, []);

  return <main className="zoom-meetings-page meeting-detail-page">
    <header className="zoom-page-header"><Link href="/meetings">&larr; Meetings</Link><span>MEETING DETAILS</span><h1>{meeting?.title ?? "Meeting"}</h1></header>
    {!meeting ? <p className="zoom-empty">This meeting is unavailable.</p> : <article className="zoom-meeting-card meeting-detail-card">
      {meeting.posterUrl && <div className="zoom-poster"><img src={meeting.posterUrl} alt={`${meeting.title} poster`}/></div>}
      <div className="zoom-meeting-copy"><span className={`meeting-status status-${meetingStatus(meeting, now)}`}>{meetingStatus(meeting, now)}</span><h2>{meeting.title}</h2>
        {meeting.description && <p>{meeting.description}</p>}
        <div className="zoom-meeting-meta"><span>{formatMeetingDate(meeting.startsAt)}</span><span>{formatMeetingTime(meeting)}</span></div>
        <MeetingCountdown meeting={meeting}/>
        <p className="meeting-format">{meeting.meetingType === "onsite" ? `Onsite · ${meeting.venue ?? "Venue to be announced"}` : "Online"}</p>
        {meetingJoinVisible(meeting, now) && <a className="zoom-join-button" href={meeting.meetingUrl} target="_blank" rel="noreferrer">Join meeting</a>}
      </div>
    </article>}
    <MobileBottomNav current="meetings"/>
  </main>;
}
