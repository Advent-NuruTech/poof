"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";
import { feedMeetings, usePublicCatalog } from "@/lib/use-catalog";
import { formatMeetingDate, formatMeetingTime, meetingJoinVisible, meetingStatus, type Meeting } from "@/lib/meetings";
import MeetingCountdown from "@/components/home/meeting-countdown";
import { sharePublicUrl } from "@/lib/share";

const CSS = `
.md-page{
  --ink:#0a0a0a;--paper:#fff;--paper-2:#f6f6f4;--paper-3:#efefec;
  --line:rgba(10,10,10,.12);--line-strong:rgba(10,10,10,.28);
  --muted:#6b6b68;--muted-2:#9a9a96;--red:#d0021b;
  background:var(--paper);color:var(--ink);min-height:100vh;
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
.md-page *{box-sizing:border-box}
.md-display{font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;font-weight:500;letter-spacing:-.04em;line-height:1.02;color:var(--ink)}

/* ===== Sticky reader bar ===== */
.md-bar{
  position:sticky;top:0;z-index:40;
  display:flex;align-items:center;gap:16px;
  padding:12px 20px;
  background:rgba(255,255,255,.85);
  backdrop-filter:blur(14px) saturate(140%);
  -webkit-backdrop-filter:blur(14px) saturate(140%);
  border-bottom:1px solid var(--line);
}
.md-back{
  display:inline-flex;align-items:center;gap:8px;
  text-decoration:none;color:var(--ink);
  font-size:12.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
  padding:8px 12px;border-radius:8px;transition:background .2s;
}
.md-back:hover{background:var(--paper-2)}
.md-back svg{width:16px;height:16px}
.md-bar-title{
  flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;
}
.md-bar-title strong{
  font-size:15.5px;font-weight:600;letter-spacing:-.01em;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.md-bar-title span{
  font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);
}
.md-bar-actions{display:flex;align-items:center;gap:10px}
.md-btn{
  display:inline-flex;align-items:center;gap:8px;
  font:inherit;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
  padding:10px 15px;border-radius:999px;text-decoration:none;cursor:pointer;
  border:1px solid var(--line-strong);background:transparent;color:var(--ink);
  transition:background .2s,color .2s,border-color .2s,transform .15s;
}
.md-btn:hover{transform:translateY(-1px)}
.md-btn svg{width:15px;height:15px;transition:transform .2s,color .2s}
.md-btn-primary{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.md-btn-primary:hover{background:var(--red);border-color:var(--red)}
.md-btn-primary:hover svg{transform:translateX(2px)}
.md-btn-ghost:hover{background:var(--paper-2);border-color:var(--ink)}

/* ===== Hero band ===== */
.md-hero{
  position:relative;padding:56px 24px 40px;overflow:hidden;
  background:
    radial-gradient(900px 340px at 50% -20%,rgba(208,2,27,.055),transparent 60%),
    radial-gradient(1200px 500px at 50% 0%,rgba(10,10,10,.045),transparent 65%),
    linear-gradient(180deg,#fbfbf9 0%,#fff 100%);
  border-bottom:1px solid var(--line);
}
.md-hero::before{
  content:"";position:absolute;inset:0;pointer-events:none;opacity:.45;
  background-image:
    linear-gradient(to right,rgba(10,10,10,.045) 1px,transparent 1px),
    linear-gradient(to bottom,rgba(10,10,10,.045) 1px,transparent 1px);
  background-size:56px 56px;
  mask-image:radial-gradient(circle at 30% 40%,#000 0%,transparent 70%);
  -webkit-mask-image:radial-gradient(circle at 30% 40%,#000 0%,transparent 70%);
}
.md-hero::after{
  content:"";position:absolute;left:24px;bottom:0;
  width:min(420px,60%);height:1px;
  background:linear-gradient(90deg,var(--red),transparent);opacity:.6;
}
.md-hero-inner{position:relative;max-width:1120px;margin:0 auto;z-index:1}

.md-eyebrow{
  display:inline-flex;align-items:center;gap:10px;
  font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0;
}
.md-eyebrow-line{display:inline-block;width:26px;height:1px;background:var(--red)}

.md-hero h1{
  font-size:clamp(34px,5vw,64px);
  margin:16px 0 18px;max-width:20ch;
}
.md-hero-meta{
  display:flex;align-items:center;flex-wrap:wrap;gap:12px;
  font-size:12.5px;letter-spacing:.02em;color:var(--muted);
}
.md-hero-meta strong{color:var(--ink);font-weight:600}
.md-dot{width:3px;height:3px;border-radius:50%;background:var(--muted-2);display:inline-block}

/* ===== Detail layout ===== */
.md-wrap{
  max-width:1120px;margin:0 auto;padding:48px 24px 80px;
  display:grid;grid-template-columns:minmax(0,1fr) minmax(0,380px);gap:48px;
  align-items:flex-start;
}
.md-content{display:flex;flex-direction:column;gap:32px;min-width:0}

.md-section-title{
  font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--muted);
  font-weight:600;margin:0 0 12px;
  display:inline-flex;align-items:center;gap:10px;
}
.md-section-title::before{
  content:"";display:inline-block;width:16px;height:1px;background:var(--red);
}

.md-lead{
  font-size:clamp(16px,1.4vw,18px);line-height:1.65;
  color:var(--ink);margin:0;
  max-width:62ch;
}
.md-desc-empty{
  font-size:15px;line-height:1.65;color:var(--muted);margin:0;
}

.md-meta-grid{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;
}
.md-meta-card{
  border:1px solid var(--line);border-radius:14px;padding:16px 18px;
  background:var(--paper);display:flex;flex-direction:column;gap:6px;
}
.md-meta-card .label{
  font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);font-weight:600;
}
.md-meta-card .value{
  font-size:14.5px;font-weight:600;color:var(--ink);letter-spacing:-.005em;
}
.md-meta-card .value.muted{color:var(--muted);font-weight:500}

.md-status-row{
  display:flex;align-items:center;gap:12px;flex-wrap:wrap;
  margin-bottom:6px;
}
.md-status{
  display:inline-flex;align-items:center;gap:8px;
  font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;font-weight:600;
  color:var(--ink);border:1px solid var(--line-strong);border-radius:999px;
  padding:5px 11px;background:var(--paper);
}
.md-status::before{
  content:"";display:inline-block;width:6px;height:6px;border-radius:50%;
  background:var(--muted-2);transform:translateY(-.5px);
}
.md-status.is-ongoing{color:var(--red);border-color:rgba(208,2,27,.4);background:rgba(208,2,27,.04)}
.md-status.is-ongoing::before{background:var(--red);box-shadow:0 0 0 4px rgba(208,2,27,.14)}
.md-status.is-upcoming::before{background:var(--ink)}
.md-status.is-completed{color:var(--muted)}
.md-status.is-completed::before{background:transparent;border:1.5px solid var(--muted-2);width:7px;height:7px}

/* ===== Poster (right column) ===== */
.md-aside{
  position:sticky;top:80px;
  display:flex;flex-direction:column;gap:16px;
  min-width:0;
}
.md-poster{
  border:1px solid var(--line);border-radius:16px;overflow:hidden;
  background:radial-gradient(120% 120% at 50% 0%,#ffffff 0%,#f4f4f1 60%,#ececea 100%);
  padding:14px;display:flex;align-items:center;justify-content:center;
  aspect-ratio:4/5;
  box-shadow:0 1px 2px rgba(10,10,10,.04),0 30px 60px -40px rgba(10,10,10,.35);
}
.md-poster img{
  max-width:100%;max-height:100%;width:auto;height:auto;
  object-fit:contain;display:block;border-radius:8px;
  box-shadow:0 1px 0 rgba(10,10,10,.05),0 20px 40px -22px rgba(10,10,10,.3);
}
.md-poster-empty{
  aspect-ratio:4/5;border:1px dashed var(--line-strong);border-radius:16px;
  display:grid;place-items:center;color:var(--muted);
  font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;font-weight:600;
}

/* ===== Actions column ===== */
.md-actions{
  display:flex;flex-direction:column;gap:10px;
  padding:20px;border:1px solid var(--line);border-radius:16px;background:var(--paper);
}
.md-actions-head{
  font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--muted);font-weight:600;
  margin-bottom:2px;
}
.md-action{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  width:100%;text-decoration:none;cursor:pointer;
  font:inherit;font-size:13px;font-weight:600;letter-spacing:.02em;
  padding:14px 16px;border-radius:12px;
  border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);
  transition:background .2s,color .2s,border-color .2s,transform .15s;
}
.md-action:hover{transform:translateY(-1px)}
.md-action svg{width:15px;height:15px;flex:0 0 auto}
.md-action-primary{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.md-action-primary:hover{background:var(--red);border-color:var(--red)}
.md-action-ghost:hover{background:var(--paper-2);border-color:var(--ink)}
.md-action-icon{
  width:38px;height:38px;padding:0;justify-content:center;flex:0 0 auto;
  border-radius:50%;
}
.md-action-icon:hover svg{color:var(--red)}
.md-action-row{display:flex;gap:10px}
.md-action-row .md-action{flex:1}

/* ===== Empty / missing ===== */
.md-empty{
  max-width:720px;margin:80px auto;padding:64px 24px;text-align:center;
  border:1px dashed var(--line-strong);border-radius:20px;
  background:linear-gradient(180deg,#fbfbf9,#fff);
}
.md-empty h2{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-weight:500;font-size:clamp(24px,3vw,36px);letter-spacing:-.03em;margin:0 0 12px}
.md-empty p{color:var(--muted);font-size:14.5px;margin:0 0 24px}

/* ===== Responsive ===== */
@media (max-width:960px){
  .md-wrap{grid-template-columns:1fr;gap:36px;padding:36px 20px 72px}
  .md-aside{position:static}
  .md-hero{padding:40px 20px 28px}
}
@media (max-width:520px){
  .md-bar{padding:10px 14px;flex-wrap:wrap;gap:10px}
  .md-bar-title{order:3;flex-basis:100%}
  .md-bar-actions{margin-left:auto}
  .md-btn span{display:none}
  .md-btn{padding:10px 12px}
}
`;

const Icon = {
  ArrowLeft: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5m6-7-7 7 7 7" />
    </svg>
  ),
  ArrowRight: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14m-6-7 7 7-7 7" />
    </svg>
  ),
  Share: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.2" />
    </svg>
  ),
  Calendar: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  ),
  Clock: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  Map: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  Globe: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </svg>
  ),
};

export default function MeetingDetail({ id }: { id: string }) {
  // Reads the shared 24-hour snapshot instead of a live per-document listener,
  // which burned a connection and duplicate reads on every visit to this page.
  const { feed } = usePublicCatalog();
  const meeting: Meeting | null = feedMeetings(feed).find((item) => item.id === id) ?? null;
  const [now, setNow] = useState(0);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  async function shareMeeting() {
    await sharePublicUrl(`${window.location.origin}/meetings/${encodeURIComponent(id)}`);
  }

  const status = meeting ? meetingStatus(meeting, now) : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="md-page">
        {/* Sticky bar */}
        <header className="md-bar">
          <Link href="/meetings" className="md-back">
            <Icon.ArrowLeft />
            <span>Meetings</span>
          </Link>

          <div className="md-bar-title">
            <strong>{meeting?.title ?? "Meeting"}</strong>
            <span>Meeting Details</span>
          </div>

          <div className="md-bar-actions">
            {meeting && (
              <button
                className="md-btn md-btn-ghost"
                type="button"
                onClick={() => void shareMeeting()}
                aria-label={`Share ${meeting.title}`}
              >
                <Icon.Share />
                <span>Share</span>
              </button>
            )}
          </div>
        </header>

        {!meeting ? (
          <section className="md-empty">
            <h2>Meeting unavailable</h2>
            <p>This meeting may have been removed or the link is no longer valid.</p>
            <Link href="/meetings" className="md-btn md-btn-primary">
              Back to meetings <Icon.ArrowRight />
            </Link>
          </section>
        ) : (
          <>
            {/* Hero band */}
            <header className="md-hero">
              <div className="md-hero-inner">
                <p className="md-eyebrow">
                  <span className="md-eyebrow-line" />
                  Meeting Details
                </p>

                <h1 className="md-display">{meeting.title}</h1>

                <div className="md-hero-meta">
                  <span>{formatMeetingDate(meeting.startsAt)}</span>
                  <span className="md-dot" />
                  <span>{formatMeetingTime(meeting)}</span>
                  <span className="md-dot" />
                  <span>
                    <strong>
                      {meeting.meetingType === "onsite"
                        ? meeting.venue ?? "Venue TBA"
                        : "Online"}
                    </strong>
                  </span>
                </div>
              </div>
            </header>

            {/* Body */}
            <div className="md-wrap">
              {/* Left: content */}
              <div className="md-content">
                <div className="md-status-row">
                  <span className={`md-status is-${status}`}>{status}</span>
                  <MeetingCountdown meeting={meeting} />
                </div>

                <section>
                  <h2 className="md-section-title">About this meeting</h2>
                  {meeting.description ? (
                    <p className="md-lead">{meeting.description}</p>
                  ) : (
                    <p className="md-desc-empty">
                      No description has been provided for this meeting yet.
                    </p>
                  )}
                </section>

                <section>
                  <h2 className="md-section-title">When &amp; where</h2>
                  <div className="md-meta-grid">
                    <div className="md-meta-card">
                      <span className="label">Date</span>
                      <span className="value">{formatMeetingDate(meeting.startsAt)}</span>
                    </div>
                    <div className="md-meta-card">
                      <span className="label">Time</span>
                      <span className="value">{formatMeetingTime(meeting)}</span>
                    </div>
                    <div className="md-meta-card">
                      <span className="label">Format</span>
                      <span className="value">
                        {meeting.meetingType === "onsite" ? "Onsite" : "Online"}
                      </span>
                    </div>
                    <div className="md-meta-card">
                      <span className="label">
                        {meeting.meetingType === "onsite" ? "Venue" : "Platform"}
                      </span>
                      <span className={`value${meeting.meetingType === "onsite" && !meeting.venue ? " muted" : ""}`}>
                        {meeting.meetingType === "onsite"
                          ? meeting.venue ?? "To be announced"
                          : "Zoom"}
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              {/* Right: poster + actions */}
              <aside className="md-aside">
                {meeting.posterUrl ? (
                  <div className="md-poster">
                    <img src={meeting.posterUrl} alt={`${meeting.title} poster`} loading="lazy" />
                  </div>
                ) : (
                  <div className="md-poster-empty">No poster</div>
                )}

                <div className="md-actions">
                  <span className="md-actions-head">Actions</span>

                  {meetingJoinVisible(meeting, now) && (
                    <a
                      className="md-action md-action-primary"
                      href={meeting.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>Join meeting</span>
                      <Icon.ArrowRight />
                    </a>
                  )}

                  <div className="md-action-row">
                    {meeting.meetingType !== "onsite" && (
                      <Link className="md-action md-action-ghost" href="/meeting-link-request">
                        <span>Request link</span>
                      </Link>
                    )}
                    <button
                      className="md-action md-action-ghost md-action-icon"
                      type="button"
                      onClick={() => void shareMeeting()}
                      aria-label={`Share ${meeting.title}`}
                      title="Share meeting"
                    >
                      <Icon.Share />
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}

        <MobileBottomNav current="meetings" />
      </main>
    </>
  );
}