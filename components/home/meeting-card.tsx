"use client";

import Link from "next/link";
import MeetingCountdown from "@/components/home/meeting-countdown";
import { formatMeetingDate, formatMeetingTime, meetingHref, meetingJoinVisible, meetingStatus, type Meeting } from "@/lib/meetings";
import { sharePublicUrl } from "@/lib/share";

export function MeetingIcon({ name }: { name: "calendar" | "clock" | "arrow" | "search" }) {
  const props = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (name === "calendar")
    return (
      <svg {...props}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </svg>
    );
  if (name === "clock")
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  if (name === "search")
    return (
      <svg {...props}>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 4 4" />
      </svg>
    );
  return (
    <svg {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const CARD_CSS = `
.mc-card{
  --ink:#0a0a0a;--paper:#fff;--paper-2:#f6f6f4;--paper-3:#efefec;
  --line:rgba(10,10,10,.12);--line-strong:rgba(10,10,10,.28);
  --muted:#6b6b68;--muted-2:#9a9a96;--red:#d0021b;
  position:relative;display:flex;flex-direction:column;overflow:hidden;
  background:var(--paper);border:1px solid var(--line);border-radius:16px;
  color:var(--ink);
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
  transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s,border-color .25s;
}
.mc-card:hover{transform:translateY(-4px);border-color:var(--line-strong);box-shadow:0 10px 30px -12px rgba(10,10,10,.18)}
.mc-card.is-ongoing{border-color:rgba(208,2,27,.35)}
.mc-card.is-ongoing::before{
  content:"";position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,var(--red),transparent);
  opacity:.85;z-index:3;
}
.mc-card *{box-sizing:border-box}

/* Poster — never cropped */
.mc-poster{
  position:relative;aspect-ratio:16/10;
  background:radial-gradient(120% 120% at 50% 0%,#ffffff 0%,#f4f4f1 60%,#ececea 100%);
  overflow:hidden;border-bottom:1px solid var(--line);
  display:flex;align-items:center;justify-content:center;
  padding:14px;
}
.mc-poster img{
  max-width:100%;max-height:100%;width:auto;height:auto;
  object-fit:contain;display:block;border-radius:6px;
  box-shadow:0 1px 0 rgba(10,10,10,.04),0 12px 30px -18px rgba(10,10,10,.28);
  transition:transform .55s cubic-bezier(.2,.8,.2,1);
}
.mc-card:hover .mc-poster img{transform:scale(1.015)}

/* Body */
.mc-copy{display:flex;flex-direction:column;gap:14px;padding:22px 22px 20px}

/* Status badge */
.mc-status{
  align-self:flex-start;display:inline-flex;align-items:center;gap:8px;
  font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;font-weight:600;
  color:var(--ink);border:1px solid var(--line-strong);border-radius:999px;
  padding:5px 11px;background:var(--paper);
}
.mc-status::before{
  content:"";display:inline-block;width:6px;height:6px;border-radius:50%;
  background:var(--muted-2);transform:translateY(-.5px);
}
.mc-status.is-ongoing{color:var(--red);border-color:rgba(208,2,27,.4);background:rgba(208,2,27,.04)}
.mc-status.is-ongoing::before{background:var(--red);box-shadow:0 0 0 4px rgba(208,2,27,.14)}
.mc-status.is-upcoming::before{background:var(--ink)}
.mc-status.is-completed{color:var(--muted)}
.mc-status.is-completed::before{background:transparent;border:1.5px solid var(--muted-2);width:7px;height:7px}

/* Title + description */
.mc-title{
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  font-weight:500;font-size:20px;line-height:1.2;letter-spacing:-.02em;
  color:var(--ink);margin:0;
}
.mc-desc{
  margin:0;font-size:13.5px;line-height:1.55;color:var(--muted);
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
}

/* Meta */
.mc-meta{display:flex;flex-direction:column;gap:8px;margin-top:2px}
.mc-meta-row{
  display:inline-flex;align-items:center;gap:10px;
  font-size:12.5px;color:var(--ink);letter-spacing:.01em;
}
.mc-meta-row svg{color:var(--muted);flex:0 0 auto}

/* Give the countdown a bit of breathing room inside the card body */
.mc-copy > .mc-countdown{margin-top:2px}

.mc-rule{height:1px;background:var(--line);margin:4px 0 2px}

/* Format row */
.mc-format{
  display:inline-flex;align-items:center;gap:8px;margin:0;
  font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600;
}
.mc-format::before{
  content:"";display:inline-block;width:14px;height:1px;background:var(--red);
}

/* Actions */
.mc-actions{
  display:flex;flex-wrap:wrap;align-items:center;gap:8px;
  margin-top:6px;padding-top:16px;border-top:1px solid var(--line);
}
.mc-btn{
  display:inline-flex;align-items:center;gap:8px;
  font:inherit;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
  padding:10px 15px;border-radius:999px;text-decoration:none;cursor:pointer;
  border:1px solid var(--line-strong);background:transparent;color:var(--ink);
  transition:background .2s,color .2s,border-color .2s,transform .15s;
}
.mc-btn:hover{transform:translateY(-1px)}
.mc-btn svg{width:14px;height:14px;transition:transform .2s,color .2s}
.mc-btn:hover svg{transform:translateX(2px)}

.mc-btn-primary{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.mc-btn-primary:hover{background:var(--red);border-color:var(--red);color:var(--paper)}

.mc-btn-ghost{color:var(--ink)}
.mc-btn-ghost:hover{background:var(--paper-2);border-color:var(--ink)}

.mc-btn-icon{width:38px;height:38px;padding:0;justify-content:center}
.mc-btn-icon svg{transform:none}
.mc-btn-icon:hover svg{transform:scale(1.05);color:var(--red)}

@media (max-width:520px){
  .mc-poster{padding:10px;aspect-ratio:16/11}
  .mc-copy{padding:18px 18px 16px;gap:12px}
  .mc-title{font-size:18px}
  .mc-btn{padding:9px 13px;font-size:11.5px}
  .mc-btn span.mc-btn-label{display:none}
  .mc-btn-icon{width:36px;height:36px}
}
`;

export default function MeetingCard({ meeting, now }: { meeting: Meeting; now: number }) {
  const status = meetingStatus(meeting, now);
  const isOngoing = status === "ongoing";

  async function shareMeeting() {
    const url = `${window.location.origin}${meetingHref(meeting)}`;
    await sharePublicUrl(url);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CARD_CSS }} />
      <article className={`mc-card${isOngoing ? " is-ongoing" : ""}`}>
        {meeting.posterUrl && (
          <div className="mc-poster">
            <img src={meeting.posterUrl} alt={`${meeting.title} poster`} loading="lazy" />
          </div>
        )}

        <div className="mc-copy">
          <span className={`mc-status is-${status}`}>{status}</span>

          <h2 className="mc-title">{meeting.title}</h2>
          {meeting.description && <p className="mc-desc">{meeting.description}</p>}

          <div className="mc-meta">
            <span className="mc-meta-row">
              <MeetingIcon name="calendar" />
              <span>{formatMeetingDate(meeting.startsAt)}</span>
            </span>
            <span className="mc-meta-row">
              <MeetingIcon name="clock" />
              <span>{formatMeetingTime(meeting)}</span>
            </span>
          </div>

          <MeetingCountdown meeting={meeting} />

          <div className="mc-rule" />

          <p className="mc-format">
            {meeting.meetingType === "onsite"
              ? `Onsite · ${meeting.venue ?? "Venue to be announced"}`
              : "Online"}
          </p>

          <div className="mc-actions">
            {meetingJoinVisible(meeting, now) && (
              <a
                className="mc-btn mc-btn-primary"
                href={meeting.meetingUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className="mc-btn-label">Join meeting</span>
                <MeetingIcon name="arrow" />
              </a>
            )}

            {meeting.meetingType !== "onsite" && (
              <Link className="mc-btn mc-btn-ghost" href="/meeting-link-request">
                <span className="mc-btn-label">Request link</span>
              </Link>
            )}

            <Link className="mc-btn mc-btn-ghost" href={meetingHref(meeting)}>
              <span className="mc-btn-label">Details</span>
            </Link>

            <button
              className="mc-btn mc-btn-ghost mc-btn-icon"
              type="button"
              onClick={() => void shareMeeting()}
              aria-label={`Share ${meeting.title}`}
              title="Share meeting"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.2" />
              </svg>
            </button>
          </div>
        </div>
      </article>
    </>
  );
}