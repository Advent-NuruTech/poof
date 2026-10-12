"use client";

import { useEffect, useState } from "react";
import type { Meeting } from "@/lib/meetings";
import {
formatMeetingDate,
formatMeetingTime,
meetingHref,
meetingJoinVisible,
} from "@/lib/meetings";
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

function Icon({
name,
size = 16,
}: {
name: "play" | "calendar" | "chevron";
size?: number;
}) {
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
return (
<svg {...common}> <path
       d="m8 5 12 7-12 7V5Z"
       fill="currentColor"
       stroke="none"
     /> </svg>
);
}

if (name === "calendar") {
return (
<svg {...common}> <rect x="3" y="5" width="18" height="16" rx="2" /> <path d="M16 3v4M8 3v4M3 10h18" /> </svg>
);
}

return (
<svg {...common}> <path d="m9 18 6-6-6-6" /> </svg>
);
}

export default function HomeHero({
items,
live,
now,
onWatch,
}: HomeHeroProps) {
const [heroIndex, setHeroIndex] = useState(0);

const itemCount = items.length;
const safeIndex = itemCount > 0 ? heroIndex % itemCount : 0;
const heroItem = items[safeIndex];

const heroVideo =
heroItem?.kind === "video" ? heroItem.video : undefined;

const heroMeeting =
heroItem?.kind === "meeting" ? heroItem.meeting : undefined;

const heroSlideKey = heroMeeting
? `meeting:${heroMeeting.id}`
: heroVideo
? `video:${heroVideo.id}`
: "empty";

const heroSlideDuration = heroMeeting
? HERO_MEETING_MS
: HERO_VIDEO_MS;

// Alternate the video and text positions for every carousel item.
const reversed = safeIndex % 2 === 1;

useEffect(() => {
if (itemCount < 2) return;

const timer = window.setTimeout(() => {
  setHeroIndex((index) => (index + 1) % itemCount);
}, heroSlideDuration);

return () => window.clearTimeout(timer);


}, [itemCount, heroSlideDuration, heroSlideKey]);

function goToPrevious() {
setHeroIndex(
(index) =>
(index + Math.max(itemCount, 1) - 1) %
Math.max(itemCount, 1),
);
}

function goToNext() {
setHeroIndex(
(index) => (index + 1) % Math.max(itemCount, 1),
);
}

function renderMeetingSlide(meeting: Meeting) {
const joinVisible = meetingJoinVisible(meeting, now);

return (
  <>
    <span className="hero-kicker">
      <span className="kicker-dot" aria-hidden="true" />
      {joinVisible ? "MEETING IN PROGRESS" : "UPCOMING MEETING"}
    </span>

    <h1>{meeting.title}</h1>

    <p className="hero-description">
      {formatMeetingDate(meeting.startsAt)} ·{" "}
      {formatMeetingTime(meeting)}
    </p>

    <div className="hero-actions">
      {joinVisible ? (
        <a
          className="watch-button"
          href={meeting.meetingUrl}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="play" />
          Join now
        </a>
      ) : (
        <a
          className="watch-button"
          href="/meeting-link-request"
        >
          <Icon name="calendar" />
          {meeting.meetingType === "onsite"
            ? "Request details"
            : "Request meeting link"}
        </a>
      )}

      <a
        className="hero-secondary-button"
        href={meetingHref(meeting)}
      >
        See details
        <Icon name="chevron" size={15} />
      </a>
    </div>
  </>
);
}

function renderHeroCopy() {
// Preserve the existing live-video behavior when a meeting
// is not the current featured slide.
if (live && !heroMeeting) {
return (
<> <span className="hero-kicker"> <span className="kicker-dot live-dot" aria-hidden="true" />
LIVE NOW </span>


      <h1>{live.title}</h1>

      <p className="hero-description">{live.channelTitle}</p>

      <button
        className="watch-button"
        onClick={() => onWatch(live)}
      >
        <Icon name="play" />
        Watch live
      </button>
    </>
  );
}

if (heroMeeting) {
  return renderMeetingSlide(heroMeeting);
}

if (heroVideo) {
  return (
    <>
      <span className="hero-kicker">
        <span className="kicker-dot" aria-hidden="true" />
        FEATURED MESSAGE
      </span>

      <h1>{heroVideo.title}</h1>

      <p className="hero-description">
        {heroVideo.channelTitle}
      </p>

      <button
        className="watch-button"
        onClick={() => onWatch(heroVideo)}
      >
        <Icon name="play" />
        Watch now
      </button>
    </>
  );
}

return (
  <>
    <span className="hero-kicker">
      <span className="kicker-dot" aria-hidden="true" />
      FAITH OF THE PIONEERS
    </span>

    <h1>Faith for every season.</h1>

    <p className="hero-description">
      A home for uplifting messages, worship, and Bible study.
    </p>

    <a className="watch-button" href="#latest">
      <Icon name="play" />
      Explore videos
    </a>
  </>
);

}

function renderHeroMedia() {
const thumbnail = heroMeeting?.posterUrl ?? heroVideo?.thumbnail;

return (
  <div className={`hero-media${thumbnail ? "" : " hero-media-empty"}`}>
    {thumbnail ? (
      <>
        <img
          key={heroSlideKey}
          src={thumbnail}
          alt={
            heroMeeting
              ? `Poster for ${heroMeeting.title}`
              : heroVideo?.title ?? "Featured message"
          }
          className="hero-image"
          fetchPriority="high"
        />
        <div className="media-label">
          <Icon name="play" size={13} />
          {heroMeeting ? "Meeting poster" : "Featured video"}
        </div>
      </>
    ) : (
      <div className="empty-media-content">
        <div className="empty-media-icon">
          <Icon name="play" size={28} />
        </div>
        <span>FAITH OF THE PIONEERS</span>
      </div>
    )}

    {itemCount > 1 && (
      <>
        <button
          type="button"
          className="hero-arrow hero-arrow-left"
          aria-label="Previous featured item"
          onClick={goToPrevious}
        >
          <Icon name="chevron" size={19} />
        </button>

        <button
          type="button"
          className="hero-arrow hero-arrow-right"
          aria-label="Next featured item"
          onClick={goToNext}
        >
          <Icon name="chevron" size={19} />
        </button>
      </>
    )}

    <div className="hero-footer">
      <div className="hero-dots" aria-label="Choose featured item">
        {Array.from(
          { length: itemCount ? Math.min(itemCount, 5) : 1 },
          (_, dot) => (
            <button
              key={dot}
              type="button"
              className={dot === safeIndex ? "dot-current" : ""}
              aria-label={`Show featured item ${dot + 1}`}
              aria-current={dot === safeIndex ? "true" : undefined}
              onClick={() => setHeroIndex(dot)}
            />
          ),
        )}
      </div>

      {itemCount > 1 && (
        <span className="hero-counter">
          {String(safeIndex + 1).padStart(2, "0")}
          <span className="counter-divider">/</span>
          {String(itemCount).padStart(2, "0")}
        </span>
      )}
    </div>
  </div>
);
}

return ( <section
   className="hero"
   id="home"
   aria-label="Featured messages and meetings"
   aria-roledescription="carousel"
 >
<div
className={`hero-layout ${reversed ? "hero-reversed" : ""}`}
key={heroSlideKey}
>
{renderHeroMedia()}


    <div className="hero-copy" aria-live="polite">
      {renderHeroCopy()}
    </div>
  </div>

    <style jsx global>{`
    .hero {
      --hero-blue: #0b3d91;
      --hero-blue-accent: #1d4ed8;
      --hero-blue-light: #bfdbfe;

      position: relative;
      isolation: isolate;
      overflow: hidden;
      color: #ffffff;
      background: var(--hero-blue);
      border: 1px solid #1d4ed8;
      border-radius: 0;
      box-shadow: 0 12px 36px rgba(11, 61, 145, 0.1);
    }

    .hero-layout {
      display: grid;
      grid-template-columns:
        minmax(0, 1.12fr)
        minmax(0, 0.88fr);
      align-items: center;
      min-height: 420px;
      animation: hero-enter 420ms ease both;
    }

    .hero-layout.hero-reversed .hero-media {
      order: 2;
    }

    .hero-layout.hero-reversed .hero-copy {
      order: 1;
    }

    .hero-media {
      position: relative;
      display: flex;
      min-width: 0;
      min-height: 420px;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      align-items: center;
      justify-content: center;
      background: #eaf2ff;
    }

    .hero-image {
      display: block;
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center;
      filter: none;
      opacity: 1;
      background: #eaf2ff;
    }

    .media-label {
      position: absolute;
      right: 16px;
      bottom: 16px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      color: #ffffff;
      background: rgba(11, 61, 145, 0.94);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 0;
      font-size: 0.75rem;
      font-weight: 650;
    }

    .hero-media-empty {
      color: var(--hero-blue);
      background: #dbeafe;
    }

    .empty-media-content {
      display: flex;
      align-items: center;
      flex-direction: column;
      gap: 16px;
      padding: 24px;
      text-align: center;
    }

    .empty-media-icon {
      display: grid;
      width: 68px;
      height: 68px;
      place-items: center;
      color: #ffffff;
      background: var(--hero-blue);
      border-radius: 0;
    }

    .empty-media-content > span {
      font-size: 0.75rem;
      font-weight: 750;
      letter-spacing: 0.14em;
    }

    .hero-copy {
      display: flex;
      min-width: 0;
      align-items: flex-start;
      justify-content: center;
      flex-direction: column;
      padding: clamp(32px, 4.5vw, 64px);
      color: #ffffff;
      background: var(--hero-blue);
    }

    .hero-kicker {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 22px;
      color: var(--hero-blue-light);
      font-size: 0.72rem;
      font-weight: 750;
      letter-spacing: 0.13em;
      line-height: 1.6;
    }

    .kicker-dot {
      width: 8px;
      height: 8px;
      flex-shrink: 0;
      background: #ffffff;
      border-radius: 50%;
    }

    .live-dot {
      background: #86efac;
      box-shadow: 0 0 0 4px rgba(134, 239, 172, 0.16);
    }

    .hero-copy h1 {
      width: 100%;
      margin: 0 0 18px;
      color: #ffffff;
      font-size: clamp(2rem, 3.25vw, 3.5rem);
      font-weight: 800;
      letter-spacing: -0.045em;
      line-height: 1.1;
      max-width: 100%;
      overflow-wrap: break-word;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 4;
      overflow: hidden;
      text-wrap: balance;
      text-transform: none;
    }

    .hero-description {
      max-width: 480px;
      margin: 0 0 28px;
      color: #dbeafe;
      font-size: 0.98rem;
      line-height: 1.8;
      overflow-wrap: anywhere;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .watch-button,
    .hero-secondary-button {
      display: inline-flex;
      min-height: 46px;
      align-items: center;
      justify-content: center;
      gap: 9px;
      padding: 12px 19px;
      border: 1px solid #ffffff;
      border-radius: 0;
      font: inherit;
      font-size: 0.9rem;
      font-weight: 700;
      line-height: 1.4;
      text-decoration: none;
      cursor: pointer;
      transition:
        background-color 180ms ease,
        color 180ms ease,
        border-color 180ms ease;
    }

    .watch-button {
      color: var(--hero-blue);
      background: #ffffff;
    }

    .watch-button:hover {
      color: var(--hero-blue);
      background: #dbeafe;
      border-color: #dbeafe;
    }

    .hero-secondary-button {
      color: #ffffff;
      background: #c51c31;
      border-color: #c51c31;
    }

    .hero-secondary-button:hover {
      color: #ffffff;
      background: #a31526;
      border-color: #a31526;
    }

    .hero-arrow {
      position: absolute;
      z-index: 3;
      top: 50%;
      display: grid;
      width: 38px;
      height: 38px;
      place-items: center;
      color: #ffffff;
      background: rgba(11, 61, 145, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.55);
      border-radius: 0;
      cursor: pointer;
      transform: translateY(-50%);
      transition:
        background-color 180ms ease,
        color 180ms ease;
    }

    .hero-arrow-left {
      left: 14px;
    }

    .hero-arrow-right {
      right: 14px;
    }

    .hero-arrow:hover {
      color: var(--hero-blue);
      background: #ffffff;
    }

    .hero-footer {
      position: absolute;
      z-index: 4;
      right: 20px;
      bottom: 16px;
      left: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .hero-dots {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      pointer-events: auto;
    }

    .hero-dots button {
      width: 7px;
      height: 7px;
      padding: 0;
      background: rgba(255, 255, 255, 0.5);
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      transition:
        width 180ms ease,
        background-color 180ms ease;
    }

    .hero-dots button.dot-current {
      width: 23px;
      background: #ffffff;
    }

    .hero-counter {
      position: absolute;
      right: 0;
      color: #dbeafe;
      font-size: 0.72rem;
      font-weight: 650;
      letter-spacing: 0.06em;
    }

    .counter-divider {
      margin: 0 6px;
      color: #93c5fd;
    }

    .hero-arrow:focus-visible,
    .hero-dots button:focus-visible,
    .watch-button:focus-visible,
    .hero-secondary-button:focus-visible {
      outline: 3px solid #bfdbfe;
      outline-offset: 4px;
    }

    @keyframes hero-enter {
      from {
        opacity: 0.65;
        transform: translateY(5px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 900px) {
      .hero-layout {
        grid-template-columns:
          minmax(0, 1fr)
          minmax(0, 0.95fr);
        min-height: 360px;
      }

      .hero-media,
      .hero-image {
        min-height: 360px;
      }

      .hero-copy {
        padding: 32px;
      }

      .hero-copy h1 {
        font-size: clamp(1.6rem, 3vw, 2.4rem);
      }

      .hero-arrow-left {
        left: 10px;
      }

      .hero-arrow-right {
        right: 10px;
      }
    }

    @media (max-width: 640px) {
      .hero-layout {
        grid-template-columns: minmax(0, 1fr);
        min-height: auto;
      }

      .hero-layout.hero-reversed .hero-media,
      .hero-layout.hero-reversed .hero-copy {
        order: initial;
      }

      .hero-media,
      .hero-image {
        width: 100%;
        min-height: 0;
        height: auto;
        aspect-ratio: 16 / 9;
      }

      .hero-image {
        height: 100%;
        min-height: 0;
        object-fit: contain;
        opacity: 0.94;
      }

      .media-label {
        right: 10px;
        bottom: 10px;
        padding: 7px 9px;
        font-size: 0.68rem;
      }

      .hero-copy {
        min-height: 245px;
        padding: 30px 24px 40px;
      }

      .hero-kicker {
        margin-bottom: 14px;
        font-size: 0.68rem;
      }

      .hero-copy h1 {
        margin-bottom: 12px;
        font-size: clamp(1.55rem, 6vw, 2.2rem);
        line-height: 1.12;
      }

      .hero-description {
        margin-bottom: 20px;
        font-size: 0.93rem;
        line-height: 1.7;
      }

      .watch-button,
      .hero-secondary-button {
        min-height: 44px;
        padding: 11px 16px;
        font-size: 0.88rem;
      }

      .hero-arrow {
        top: 24%;
        width: 34px;
        height: 34px;
      }

      .hero-arrow-left {
        left: 10px;
      }

      .hero-arrow-right {
        right: 10px;
      }

      .hero-footer {
        bottom: 12px;
      }

      .hero-counter {
        display: none;
      }
    }

    @media (max-width: 380px) {
      .hero-copy {
        padding: 26px 20px 38px;
      }

      .hero-copy h1 {
        font-size: 1.75rem;
      }

      .hero-actions {
        align-items: stretch;
        flex-direction: column;
        width: 100%;
      }

      .watch-button,
      .hero-secondary-button {
        width: 100%;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .hero-layout {
        animation: none;
      }

      .hero-arrow,
      .hero-dots button,
      .watch-button,
      .hero-secondary-button {
        transition: none;
      }
    }
  `}</style>
</section>


);
}
