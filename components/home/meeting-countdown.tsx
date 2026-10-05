"use client";

import { useEffect, useState } from "react";
import { meetingCountdown, meetingStatus, type Meeting } from "@/lib/meetings";

export default function MeetingCountdown({ meeting }: { meeting: Meeting }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  const label = meetingCountdown(meeting, now);
  if (!label) return null;
  return <p className="meeting-countdown" role="timer" aria-live="off">{meetingStatus(meeting, now) === "ongoing" ? "Ends in" : "Starts in"} <b>{label}</b></p>;
}
