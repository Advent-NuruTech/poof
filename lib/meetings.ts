export type EventStatus = "ongoing" | "upcoming" | "completed";

export type Meeting = {
  id: string;
  title: string;
  description?: string;
  posterUrl?: string;
  startsAt: string;
  endsAt: string;
  meetingType?: "online" | "onsite";
  meetingUrl?: string;
  venue?: string;
};

export function meetingStatus(meeting: Meeting, now = Date.now()): EventStatus {
  const start = new Date(meeting.startsAt).getTime();
  const end = new Date(meeting.endsAt).getTime();
  return now >= end ? "completed" : now >= start ? "ongoing" : "upcoming";
}

export function eventGroups(meetings: Meeting[], now: number): { status: EventStatus; label: string; meetings: Meeting[] }[] {
  return [
    { status: "ongoing", label: "Ongoing", meetings: meetings.filter((item) => meetingStatus(item, now) === "ongoing").sort((a, b) => a.endsAt.localeCompare(b.endsAt)) },
    { status: "upcoming", label: "Upcoming", meetings: meetings.filter((item) => meetingStatus(item, now) === "upcoming").sort((a, b) => a.startsAt.localeCompare(b.startsAt)) },
    { status: "completed", label: "Completed", meetings: meetings.filter((item) => meetingStatus(item, now) === "completed").sort((a, b) => b.startsAt.localeCompare(a.startsAt)) },
  ];
}

export function formatCountdown(target: string, now: number) {
  const remaining = new Date(target).getTime() - now;
  if (!now || !Number.isFinite(remaining) || remaining <= 0) return "";
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return days > 0 ? `${days}d ${clock}` : clock;
}

export function meetingCountdown(meeting: Meeting, now: number) {
  return meetingStatus(meeting, now) === "ongoing" ? formatCountdown(meeting.endsAt, now) : formatCountdown(meeting.startsAt, now);
}

export function meetingJoinVisible(meeting: Meeting, now = Date.now()) {
  return meeting.meetingType !== "onsite" && Boolean(meeting.meetingUrl) && now >= new Date(meeting.startsAt).getTime() - 60 * 60 * 1000 && now < new Date(meeting.endsAt).getTime();
}

export function meetingSearchText(meeting: Meeting) {
  return `${meeting.title} ${meeting.description ?? ""} ${meeting.venue ?? ""} ${meeting.meetingType === "onsite" ? "onsite in person venue" : "online zoom"}`.toLowerCase();
}

export function formatMeetingDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date(value));
}

export function formatMeetingDay(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function formatMeetingTime(meeting: Meeting) {
  const options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${new Intl.DateTimeFormat(undefined, options).format(new Date(meeting.startsAt))} – ${new Intl.DateTimeFormat(undefined, options).format(new Date(meeting.endsAt))}`;
}
