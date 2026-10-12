"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatMeetingDate, meetingHref, meetingStatus, type Meeting } from "@/lib/meetings";

type AboutMeetingCarouselProps = {
  meetings: Meeting[];
  loaded: boolean;
  now: number;
};

const SLIDE_DURATION_MS = 6500;

export default function AboutMeetingCarousel({ meetings, loaded, now }: AboutMeetingCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const posterMeetings = useMemo(() => {
    if (!loaded || !now) return [];

    return meetings
      .filter((meeting): meeting is Meeting & { posterUrl: string } =>
        Boolean(meeting.posterUrl) &&
        Number.isFinite(Date.parse(meeting.startsAt)) &&
        Number.isFinite(Date.parse(meeting.endsAt)),
      )
      .sort((a, b) => {
        const statusOrder = { upcoming: 0, ongoing: 1, completed: 2 };
        const statusDifference = statusOrder[meetingStatus(a, now)] - statusOrder[meetingStatus(b, now)];
        if (statusDifference) return statusDifference;
        return meetingStatus(a, now) === "completed"
          ? b.startsAt.localeCompare(a.startsAt)
          : a.startsAt.localeCompare(b.startsAt);
      });
  }, [loaded, meetings, now]);

  useEffect(() => {
    if (posterMeetings.length < 2) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((index) => (index + 1) % posterMeetings.length);
    }, SLIDE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, posterMeetings.length]);

  if (!posterMeetings.length) return null;

  const index = activeIndex % posterMeetings.length;
  const meeting = posterMeetings[index];
  const status = meetingStatus(meeting, now);
  const showRelative = (offset: number) => {
    setActiveIndex((current) => (current + offset + posterMeetings.length) % posterMeetings.length);
  };

  return (
    <section className="about-meeting-carousel" aria-label="Meeting posters">
      <div className="about-meeting-carousel-stage">
        <Link className="about-meeting-slide" href={meetingHref(meeting)} key={meeting.id}>
          <Image
            src={meeting.posterUrl}
            alt={`Poster for ${meeting.title}`}
            fill
            sizes="(max-width: 760px) 90vw, 32vw"
            unoptimized
          />
        </Link>
        {posterMeetings.length > 1 && <>
          <button className="about-meeting-control previous" type="button" aria-label="Show previous meeting poster" onClick={() => showRelative(-1)}>‹</button>
          <button className="about-meeting-control next" type="button" aria-label="Show next meeting poster" onClick={() => showRelative(1)}>›</button>
        </>}
      </div>
      <div className="about-meeting-caption">
        <span>{status === "completed" ? "PAST MEETING" : status === "ongoing" ? "HAPPENING NOW" : "UPCOMING MEETING"} · {formatMeetingDate(meeting.startsAt)}</span>
        <strong>{meeting.title}</strong>
        {posterMeetings.length > 1 && <small>{index + 1} of {posterMeetings.length}</small>}
      </div>
    </section>
  );
}
