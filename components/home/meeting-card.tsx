"use client";

import Link from "next/link";
import MeetingCountdown from "@/components/home/meeting-countdown";
import { formatMeetingDate, formatMeetingTime, meetingJoinVisible, meetingStatus, type Meeting } from "@/lib/meetings";
import { sharePublicUrl } from "@/lib/share";

export function MeetingIcon({ name }: { name: "calendar" | "clock" | "arrow" | "search" }) {
  const props = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (name === "calendar") return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>;
  if (name === "clock") return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  if (name === "search") return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg>;
  return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
}

export default function MeetingCard({ meeting, now }: { meeting: Meeting; now: number }) {
  const status = meetingStatus(meeting, now);

  async function shareMeeting() {
    const url = `${window.location.origin}/meetings/${encodeURIComponent(meeting.id)}`;
    await sharePublicUrl(url);
  }

  return <article className="zoom-meeting-card">
    {meeting.posterUrl && <div className="zoom-poster"><img src={meeting.posterUrl} alt={`${meeting.title} poster`}/></div>}
    <div className="zoom-meeting-copy">
      <span className={`meeting-status status-${status}`}>{status}</span>
      <h2>{meeting.title}</h2>
      {meeting.description && <p>{meeting.description}</p>}
      <div className="zoom-meeting-meta">
        <span><MeetingIcon name="calendar"/>{formatMeetingDate(meeting.startsAt)}</span>
        <span><MeetingIcon name="clock"/>{formatMeetingTime(meeting)}</span>
      </div>
      <MeetingCountdown meeting={meeting}/>
      <p className="meeting-format">{meeting.meetingType === "onsite" ? `Onsite · ${meeting.venue ?? "Venue to be announced"}` : "Online"}</p>
      <div className="meeting-actions">
        {meetingJoinVisible(meeting, now) && <a className="zoom-join-button" href={meeting.meetingUrl} target="_blank" rel="noreferrer">Join meeting <MeetingIcon name="arrow"/></a>}
        {meeting.meetingType !== "onsite" && <Link className="meeting-request-button" href="/meeting-link-request">Request meeting link</Link>}
        <Link className="meeting-details-button" href={`/meetings/${encodeURIComponent(meeting.id)}`}>Details</Link>
        <button className="meeting-share-button" type="button" onClick={() => void shareMeeting()} aria-label={`Share ${meeting.title}`} title="Share meeting"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.2"/></svg><span>Share</span></button>
      </div>
    </div>
  </article>;
}
