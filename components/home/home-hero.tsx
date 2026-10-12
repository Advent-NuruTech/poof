"use client";

import { useEffect, useState } from "react";
import type { Meeting } from "@/lib/meetings";
import { formatMeetingDate, formatMeetingTime, meetingHref, meetingJoinVisible } from "@/lib/meetings";
import type { Video } from "@/lib/catalog";

type HeroItem =
  | { kind: "meeting"; meeting: Meeting }
  | { kind: "video"; video: Video };

type HomeHeroProps = {
  items: HeroItem[];
  live?: Video;
  now: number;
  onWatch: (video: Video) => void;
};

const HERO_MEETING_MS = 15_000;
const HERO_VIDEO_MS = 5_000;

function Icon({ name, size = 16 }: { name: "play" | "calendar" | "chevron"; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (name === "play") {
    return <svg {...common}><path d="m8 5 12 7-12 7V5Z" fill="currentColor" stroke="none"/></svg>;
  }
  if (name === "calendar") {
    return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>;
  }
  return <svg {...common}><path d="m9 18 6-6-6-6"/></svg>;
}

export default function HomeHero({ items, live, now, onWatch }: HomeHeroProps) {
  const [heroIndex, setHeroIndex] = useState(0);
  const heroItem = items[items.length ? heroIndex % items.length : 0];
  const heroVideo = heroItem?.kind === "video" ? heroItem.video : undefined;
  const heroMeeting = heroItem?.kind === "meeting" ? heroItem.meeting : undefined;
  const heroSlideKey = heroMeeting ? `meeting:${heroMeeting.id}` : heroVideo ? `video:${heroVideo.id}` : "empty";
  const heroSlideDuration = heroMeeting ? HERO_MEETING_MS : HERO_VIDEO_MS;

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setTimeout(() => setHeroIndex((index) => (index + 1) % items.length), heroSlideDuration);
    return () => window.clearTimeout(timer);
  }, [items.length, heroSlideDuration, heroSlideKey]);

  function renderMeetingSlide(meeting: Meeting) {
    return <>
      <span className="hero-kicker"><i/> MEETING</span>
      <h1>{meeting.title}</h1>
      <p>{formatMeetingDate(meeting.startsAt)} · {formatMeetingTime(meeting)}</p>
      <div className="hero-actions">
        {meetingJoinVisible(meeting, now) ? <a className="watch-button" href={meeting.meetingUrl} target="_blank" rel="noreferrer"><Icon name="play"/> Join now</a>
          : meeting.meetingType === "onsite" ? <a className="watch-button" href="/meeting-link-request"><Icon name="calendar"/> Request details</a>
          : <a className="watch-button" href="/meeting-link-request"><Icon name="calendar"/> Request meeting link</a>}
        <a className="hero-secondary-button" href={meetingHref(meeting)}>See details</a>
      </div>
    </>;
  }

  return (
    <section
      className="hero"
      id="home"
      style={{
        backgroundImage: heroVideo?.thumbnail
          ? `linear-gradient(90deg, rgba(5,13,18,.88) 0%, rgba(5,13,18,.48) 42%, rgba(5,13,18,.02) 100%), url("${heroVideo.thumbnail}")`
          : "radial-gradient(ellipse at 74% 45%, #bd9154 0%, #654c37 17%, transparent 38%), linear-gradient(110deg, #111e24, #293b3f 58%, #11191d)",
      }}
    >
      <button
        className="hero-arrow hero-arrow-left"
        aria-label="Previous featured item"
        disabled={items.length < 2}
        onClick={() => setHeroIndex((index) => (index + Math.max(items.length, 1) - 1) % Math.max(items.length, 1))}
      >
        <Icon name="chevron" size={20}/>
      </button>
      <div className="hero-copy">
        {live && !heroMeeting ? <>
          <span className="hero-kicker"><i/> LIVE NOW</span>
          <h1>{live.title}</h1>
          <p>{live.channelTitle}</p>
          <button className="watch-button" onClick={() => onWatch(live)}><Icon name="play"/> Watch now</button>
        </> : heroMeeting ? renderMeetingSlide(heroMeeting) : <>
          <span className="hero-kicker">{heroVideo ? "FEATURED MESSAGE" : "FAITH OF THE PIONEERS"}</span>
          <h1>{heroVideo?.title ?? <>Faith for<br/>every season.</>}</h1>
          <p>{heroVideo?.channelTitle ?? "A home for uplifting messages, worship, and Bible study."}</p>
          {heroVideo
            ? <button className="watch-button" onClick={() => onWatch(heroVideo)}><Icon name="play"/> Watch now</button>
            : <a className="watch-button" href="#latest"><Icon name="play"/> Explore videos</a>}
        </>}
      </div>
      <button
        className="hero-arrow hero-arrow-right"
        aria-label="Next featured item"
        disabled={items.length < 2}
        onClick={() => setHeroIndex((index) => (index + 1) % Math.max(items.length, 1))}
      >
        <Icon name="chevron" size={20}/>
      </button>
      <div className="hero-dots">
        {Array.from({ length: items.length ? Math.min(items.length, 4) : 4 }, (_, dot) => (
          <button
            key={dot}
            className={dot === heroIndex % Math.max(items.length, 1) ? "dot-current" : ""}
            aria-label={`Show featured item ${dot + 1}`}
            onClick={() => setHeroIndex(dot)}
          />
        ))}
      </div>
    </section>
  );
}
