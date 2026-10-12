"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { meetingGroups } from "@/lib/meetings";
import { feedMeetings, usePublicCatalog } from "@/lib/use-catalog";

export default function AboutMeetingPoster() {
  const { feed, status } = usePublicCatalog();
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const posterUrl = useMemo(() => {
    if (status !== "ready" || !now) return "";
    const groups = meetingGroups(feedMeetings(feed), now);
    const nearest = groups.find((group) => group.status === "upcoming")?.meetings[0]
      ?? groups.find((group) => group.status === "ongoing")?.meetings[0];
    return nearest?.posterUrl ?? "";
  }, [feed, now, status]);

  if (!posterUrl) return null;

  return <Image className="about-meeting-poster" src={posterUrl} alt="Poster for the nearest meeting" width={1600} height={900} unoptimized/>;
}
