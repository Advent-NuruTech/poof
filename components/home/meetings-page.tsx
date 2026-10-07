"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { feedMeetings, usePublicCatalog } from "@/lib/use-catalog";
import { meetingGroups, meetingSearchText, type MeetingStatus } from "@/lib/meetings";
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

const CSS = `
.zm-page{
  --ink:#0a0a0a;--paper:#fff;--paper-2:#f6f6f4;--paper-3:#efefec;
  --line:rgba(10,10,10,.12);--line-strong:rgba(10,10,10,.28);
  --muted:#6b6b68;--muted-2:#9a9a96;--red:#d0021b;
  background:var(--paper);color:var(--ink);min-height:100vh;
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
.zm-page *{box-sizing:border-box}
.zm-display{
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  font-weight:500;letter-spacing:-.045em;line-height:.95;color:var(--ink);
}

.zm-eyebrow{display:inline-flex;align-items:center;gap:10px;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0}
.zm-eyebrow-line{display:inline-block;width:26px;height:1px;background:var(--red)}
.zm-h2{font-family:"Helvetica Neue",Helvetica,Inter,sans-serif;font-weight:500;font-size:clamp(24px,2.6vw,34px);letter-spacing:-.03em;margin:0;line-height:1.05}
.zm-dot{width:3px;height:3px;border-radius:50%;background:var(--muted-2);display:inline-block}

/* ============ HERO ============ */
.zm-hero{
  position:relative;padding:64px 24px 48px;text-align:center;overflow:hidden;
  background:
    radial-gradient(900px 340px at 50% -20%,rgba(208,2,27,.06),transparent 60%),
    radial-gradient(1200px 500px at 50% 0%,rgba(10,10,10,.05),transparent 65%),
    linear-gradient(180deg,#fbfbf9 0%,#fff 100%);
  border-bottom:1px solid var(--line);
}
.zm-hero::before{
  content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;
  background-image:
    linear-gradient(to right,rgba(10,10,10,.045) 1px,transparent 1px),
    linear-gradient(to bottom,rgba(10,10,10,.045) 1px,transparent 1px);
  background-size:56px 56px;
  mask-image:radial-gradient(circle at 50% 30%,#000 0%,transparent 70%);
  -webkit-mask-image:radial-gradient(circle at 50% 30%,#000 0%,transparent 70%);
}
.zm-hero::after{
  content:"";position:absolute;left:50%;bottom:0;transform:translateX(-50%);
  width:min(560px,70%);height:1px;
  background:linear-gradient(90deg,transparent,var(--red),transparent);opacity:.55;
}
.zm-hero-inner{position:relative;max-width:1120px;margin:0 auto;z-index:1}

.zm-crumbs{display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:22px}
.zm-crumbs a{color:var(--ink);text-decoration:none;border-bottom:1px solid transparent;transition:border-color .2s}
.zm-crumbs a:hover{border-color:var(--red)}

.zm-title{font-size:clamp(44px,7.5vw,100px);margin:14px 0 18px}
.zm-title em{font-style:normal;color:var(--red);font-weight:500}

.zm-lede{font-size:clamp(15px,1.3vw,17px);line-height:1.6;color:var(--muted);max-width:56ch;margin:0 auto 32px}

.zm-hero-meta{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:22px;font-size:12.5px;color:var(--muted);letter-spacing:.02em}
.zm-hero-meta strong{color:var(--ink);font-weight:600}

/* ============ FLOATING TOOLBAR ============ */
.zm-toolbar-wrap{
  position:sticky;top:0;z-index:50;
  padding:14px 24px;
  transition:padding .25s ease,background .25s ease,box-shadow .25s ease,border-color .25s ease;
  border-bottom:1px solid transparent;
  background:transparent;
}
.zm-toolbar-wrap.is-floating{
  padding:10px 24px;
  background:rgba(255,255,255,.82);
  backdrop-filter:blur(16px) saturate(140%);
  -webkit-backdrop-filter:blur(16px) saturate(140%);
  box-shadow:0 1px 0 rgba(10,10,10,.06),0 14px 40px -28px rgba(10,10,10,.35);
  border-bottom:1px solid var(--line);
}
.zm-toolbar{
  max-width:1120px;margin:0 auto;
  display:flex;align-items:center;gap:14px;
}
.zm-search{
  position:relative;display:flex;align-items:center;flex:1 1 auto;min-width:0;
  background:var(--paper);border:1px solid var(--line-strong);border-radius:999px;
  padding:0 20px;height:56px;
  box-shadow:0 1px 2px rgba(10,10,10,.04);
  transition:border-color .2s,box-shadow .2s,height .25s ease;
}
.zm-toolbar-wrap.is-floating .zm-search{height:48px;box-shadow:0 1px 2px rgba(10,10,10,.06)}
.zm-search:focus-within{border-color:var(--ink);box-shadow:0 0 0 4px rgba(208,2,27,.10)}
.zm-search .zm-search-icon{
  width:18px;height:18px;color:var(--muted);flex:0 0 auto;display:grid;place-items:center;
}
.zm-search .zm-search-icon svg{width:18px;height:18px}
.zm-search input{
  flex:1;border:0;outline:0;background:transparent;font:inherit;font-size:15px;color:var(--ink);
  padding:0 12px;height:100%;min-width:0;
}
.zm-search input::placeholder{color:var(--muted-2)}
.zm-search-clear{
  border:0;background:transparent;color:var(--muted);font-size:22px;line-height:1;cursor:pointer;padding:0 4px;
}
.zm-search-clear:hover{color:var(--red)}

/* Status chip rail (right of search) */
.zm-status-rail{
  display:flex;align-items:center;gap:8px;flex:0 1 auto;
  overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;
  padding:4px 2px;max-width:56%;
}
.zm-status-rail::-webkit-scrollbar{display:none}
.zm-chip{
  flex:0 0 auto;
  border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);
  padding:9px 16px;border-radius:999px;font:inherit;font-size:12.5px;letter-spacing:.02em;
  cursor:pointer;white-space:nowrap;
  display:inline-flex;align-items:center;gap:8px;
  transition:background .2s,color .2s,border-color .2s,transform .15s;
}
.zm-chip:hover{border-color:var(--ink);transform:translateY(-1px)}
.zm-chip.is-active{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.zm-chip.is-active::before{
  content:"";display:inline-block;width:6px;height:6px;background:var(--red);
  border-radius:50%;transform:translateY(-1px);
}
.zm-chip b{
  font-weight:600;font-size:11px;padding:2px 7px;border-radius:999px;
  background:var(--paper-3);color:var(--ink);letter-spacing:.02em;
  transition:background .2s,color .2s;
}
.zm-chip.is-active b{background:rgba(255,255,255,.14);color:var(--paper)}
.zm-chip.is-active b::after{content:""}

/* ============ SECTIONS ============ */
.zm-section{max-width:1120px;margin:0 auto;padding:56px 24px 40px}
.zm-section-alt{border-top:1px solid var(--line);margin-top:32px;padding-top:64px;background:linear-gradient(180deg,#fbfbf9,#fff)}

.zm-results-count{
  max-width:1120px;margin:8px auto 0;padding:0 24px;
  font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600;
}
.zm-results-count::before{
  content:"";display:inline-block;width:20px;height:1px;background:var(--red);
  vertical-align:middle;margin-right:10px;transform:translateY(-1px);
}

.zm-group{max-width:1120px;margin:0 auto;padding:40px 24px 8px}
.zm-group-head{
  display:flex;align-items:flex-end;justify-content:space-between;gap:24px;
  margin-bottom:22px;flex-wrap:wrap;
}
.zm-group-head-left{display:flex;align-items:center;gap:16px}

.zm-status-dot{
  display:inline-block;width:8px;height:8px;border-radius:50%;
  background:var(--muted-2);position:relative;flex:0 0 auto;
}
.zm-status-dot.is-ongoing{background:var(--red)}
.zm-status-dot.is-ongoing::after{
  content:"";position:absolute;inset:-4px;border-radius:50%;
  border:1px solid var(--red);opacity:.45;
  animation:zm-pulse 2s ease-in-out infinite;
}
.zm-status-dot.is-upcoming{background:var(--ink)}
.zm-status-dot.is-completed{background:transparent;border:1.5px solid var(--muted-2)}
@keyframes zm-pulse{
  0%,100%{transform:scale(1);opacity:.45}
  50%{transform:scale(1.35);opacity:0}
}

.zm-count-pill{
  font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;
  color:var(--muted);border:1px solid var(--line-strong);border-radius:999px;
  padding:5px 11px;background:var(--paper);
}

.zm-list{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(320px,1fr));
  gap:24px;
}

/* Re-skin MeetingCard's wrapper inside our grid so it fits the premium look */
.zm-list > *{
  background:var(--paper);
  border:1px solid var(--line);
  border-radius:14px;
  transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s,border-color .25s;
}
.zm-list > *:hover{
  transform:translateY(-4px);
  border-color:var(--line-strong);
  box-shadow:0 10px 30px -12px rgba(10,10,10,.18);
}

.zm-empty{
  max-width:1120px;margin:0 auto;padding:36px 24px;
  text-align:center;color:var(--muted);font-size:14px;
}
.zm-empty-filtered{
  max-width:1120px;margin:24px auto 0;padding:48px 24px;
  border:1px dashed var(--line-strong);border-radius:16px;
  background:linear-gradient(180deg,#fbfbf9,#fff);
  font-size:14.5px;
}

@media (max-width:900px){
  .zm-status-rail{max-width:100%}
}
@media (max-width:720px){
  .zm-page{padding-bottom:calc(84px + env(safe-area-inset-bottom))}
  .zm-hero{padding:44px 20px 32px}
  .zm-toolbar{flex-direction:column;align-items:stretch;gap:10px}
  .zm-status-rail{max-width:100%;padding-bottom:6px}
  .zm-section{padding:36px 20px 24px}
  .zm-group{padding:28px 20px 8px}
  .zm-list{gap:16px;grid-template-columns:1fr}
}
`;

export default function MeetingsPage() {
  const [now, setNow] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [floating, setFloating] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reads the shared 24-hour snapshot rather than opening its own live
  // listener on the meetings collection on every visit to the schedule page.
  const { feed } = usePublicCatalog();
  const meetings = feedMeetings(feed);
  const loaded = feed.fetchedAt !== "";

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  /* Floating toolbar on scroll */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setFloating(!entry.isIntersecting),
      { rootMargin: "0px 0px -80% 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const term = search.trim().toLowerCase();
  const groups = meetingGroups(meetings, now);

  const matched = groups.map((group) => ({
    ...group,
    meetings: term
      ? group.meetings.filter((item) => meetingSearchText(item).includes(term))
      : group.meetings,
  }));

  const counts: Record<StatusFilter, number> = { all: 0, ongoing: 0, upcoming: 0, completed: 0 };
  for (const group of matched) {
    counts[group.status] = group.meetings.length;
    counts.all += group.meetings.length;
  }

  const visibleGroups =
    statusFilter === "all"
      ? matched.filter((group) => group.status !== "ongoing" || group.meetings.length > 0)
      : matched.filter((group) => group.status === statusFilter);

  const filtering = Boolean(term) || statusFilter !== "all";
  const activeLabel =
    statusOptions.find((option) => option.value === statusFilter)?.label.toLowerCase() ?? "";

  const resultsLabel = filtering
    ? `${counts.all} ${counts.all === 1 ? "meeting" : "meetings"} ${
        term ? `matching “${search.trim()}”` : `${activeLabel} only`
      }`
    : `${counts.all} ${counts.all === 1 ? "meeting" : "meetings"} scheduled`;

  const statusDotClass = (status: MeetingStatus) =>
    `zm-status-dot${
      status === "ongoing"
        ? " is-ongoing"
        : status === "upcoming"
        ? " is-upcoming"
        : status === "completed"
        ? " is-completed"
        : ""
    }`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="zm-page">
        {/* HERO */}
        <header className="zm-hero">
          <div className="zm-hero-inner">
            <nav className="zm-crumbs">
              <Link href="/">Home</Link>
              <span aria-hidden="true">/</span>
              <span>Meetings</span>
            </nav>

            <p className="zm-eyebrow">
              <span className="zm-eyebrow-line" />
              Meeting Schedule
            </p>

            <h1 className="zm-title zm-display">
              Zoom <em>Meetings</em>
            </h1>

            <p className="zm-lede">
              Join a live gathering or view upcoming and past meetings — all in one place.
            </p>

            <div className="zm-hero-meta">
              <span>
                <strong>{counts.all}</strong> {counts.all === 1 ? "meeting" : "meetings"}
              </span>
              <span className="zm-dot" />
              <span>
                <strong>{counts.ongoing}</strong> live
              </span>
              <span className="zm-dot" />
              <span>
                <strong>{counts.upcoming}</strong> upcoming
              </span>
            </div>
          </div>
        </header>

        {/* Sentinel for floating toolbar */}
        <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />

        {/* FLOATING TOOLBAR */}
        <div className={`zm-toolbar-wrap${floating ? " is-floating" : ""}`}>
          <div className="zm-toolbar">
            <div className="zm-search">
              <span className="zm-search-icon" aria-hidden="true">
                <MeetingIcon name="search" />
              </span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearch("");
                }}
                placeholder="Search meetings by title, topic, or venue"
                aria-label="Search meetings"
              />
              {search && (
                <button
                  className="zm-search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  type="button"
                >
                  ×
                </button>
              )}
            </div>

            <nav className="zm-status-rail" aria-label="Filter meetings by status">
              {statusOptions.map((option) => {
                const active = statusFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`zm-chip${active ? " is-active" : ""}`}
                    aria-pressed={active}
                    onClick={() => setStatusFilter(option.value)}
                  >
                    {option.label}
                    <b>{counts[option.value]}</b>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* RESULTS */}
        {!loaded ? (
          <section className="zm-section">
            <div className="zm-group-head">
              <div className="zm-group-head-left">
                <span className="zm-status-dot" />
                <h2 className="zm-h2">Meetings</h2>
              </div>
            </div>
            <MeetingListSkeleton />
          </section>
        ) : (
          <>
            <p className="zm-results-count" role="status">
              {resultsLabel}
            </p>

            {visibleGroups.length ? (
              visibleGroups.map((group) => (
                <section className="zm-group" key={group.status}>
                  <div className="zm-group-head">
                    <div className="zm-group-head-left">
                      <span className={statusDotClass(group.status)} aria-hidden="true" />
                      <h2 className="zm-h2">{group.label}</h2>
                    </div>
                    <span className="zm-count-pill">
                      {group.meetings.length}{" "}
                      {group.meetings.length === 1 ? "meeting" : "meetings"}
                    </span>
                  </div>

                  {group.meetings.length ? (
                    <div className="zm-list">
                      {group.meetings.map((meeting) => (
                        <MeetingCard key={meeting.id} meeting={meeting} now={now} />
                      ))}
                    </div>
                  ) : (
                    <p className="zm-empty">{emptyMessages[group.status]}</p>
                  )}
                </section>
              ))
            ) : (
              <p className="zm-empty zm-empty-filtered">
                No meetings match your search. Try another title, topic, or venue.
              </p>
            )}
          </>
        )}

        <MobileBottomNav current="meetings" />
      </main>
    </>
  );
}
