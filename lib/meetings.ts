export type MeetingStatus = "ongoing" | "upcoming" | "completed";

export type MeetingRecurrence = {
  frequency: "weekly";
  /** JavaScript weekday values: 0 = Sunday through 6 = Saturday. */
  days: number[];
  /** Inclusive local date in the scheduler's timezone, or omitted for never. */
  until?: string;
};

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
  /** The scheduler's IANA timezone, retained as a reference for administrators. */
  timeZone?: string;
  recurrence?: MeetingRecurrence;
  /** Present only on generated occurrences of a recurring meeting. */
  sourceId?: string;
  occurrenceDate?: string;
};

/** The browser's IANA timezone, for example "America/Los_Angeles". */
export function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function localDateParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function localDateKey(parts: Pick<ReturnType<typeof localDateParts>, "year" | "month" | "day">) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function zonedDateTimeToIso(parts: ReturnType<typeof localDateParts>, timeZone: string) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = localDateParts(new Date(guess).toISOString(), timeZone);
    const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    guess += target - actualUtc;
  }
  return new Date(guess).toISOString();
}

/** Expands recurring meetings only for the current calendar week in the viewer's timezone. */
export function expandRecurringMeetings(meetings: Meeting[], now = Date.now()) {
  const reference = now || Date.now();
  const today = new Date(reference);
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 7);
  const dayMs = 24 * 60 * 60 * 1000;
  return meetings.flatMap((meeting) => {
    const recurrence = meeting.recurrence;
    if (!recurrence || recurrence.frequency !== "weekly" || !recurrence.days.length) return [meeting];
    const timeZone = meeting.timeZone || "UTC";
    const initial = localDateParts(meeting.startsAt, timeZone);
    const firstDate = localDateKey(initial);
    const duration = new Date(meeting.endsAt).getTime() - new Date(meeting.startsAt).getTime();
    const occurrences: Meeting[] = [];
    // Scheduler-local dates can differ from the viewer's dates across time zones.
    const cursor = new Date(Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - Math.ceil(Math.max(duration, 0) / dayMs) - 1));
    const lastDate = new Date(Date.UTC(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate() + 1));
    for (; cursor <= lastDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const occurrenceParts = { ...initial, year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1, day: cursor.getUTCDate() };
      const occurrenceDate = localDateKey(occurrenceParts);
      if (!recurrence.days.includes(cursor.getUTCDay()) || occurrenceDate < firstDate || (recurrence.until && occurrenceDate > recurrence.until)) continue;
      const startsAt = zonedDateTimeToIso(occurrenceParts, timeZone);
      const endsAt = new Date(new Date(startsAt).getTime() + duration).toISOString();
      if (new Date(startsAt).getTime() >= weekEnd.getTime() || new Date(endsAt).getTime() <= weekStart.getTime()) continue;
      occurrences.push({ ...meeting, id: `${meeting.id}--${occurrenceDate}`, sourceId: meeting.id, occurrenceDate, startsAt, endsAt });
    }
    return occurrences;
  });
}

/** Collapses expanded recurring occurrences back to one entry per meeting, keeping the soonest occurrence of each. */
export function collapseMeetingOccurrences(meetings: Meeting[], now = Date.now()) {
  const expanded = expandRecurringMeetings(meetings, now);
  const bySource = new Map<string, Meeting>();
  for (const meeting of expanded) {
    const key = meeting.sourceId ?? meeting.id;
    const current = bySource.get(key);
    if (!current || meeting.startsAt.localeCompare(current.startsAt) < 0) bySource.set(key, meeting);
  }
  return [...bySource.values()];
}

export function meetingHref(meeting: Meeting) {
  const occurrence = meeting.occurrenceDate ? `?occurrence=${encodeURIComponent(meeting.occurrenceDate)}` : "";
  return `/meetings/${encodeURIComponent(meeting.sourceId ?? meeting.id)}${occurrence}`;
}

export function meetingStatus(meeting: Meeting, now = Date.now()): MeetingStatus {
  const start = new Date(meeting.startsAt).getTime();
  const end = new Date(meeting.endsAt).getTime();
  return now >= end ? "completed" : now >= start ? "ongoing" : "upcoming";
}

export function meetingGroups(meetings: Meeting[], now: number): { status: MeetingStatus; label: string; meetings: Meeting[] }[] {
  const occurrences = expandRecurringMeetings(meetings, now);
  return [
    { status: "ongoing", label: "Ongoing", meetings: occurrences.filter((item) => meetingStatus(item, now) === "ongoing").sort((a, b) => a.endsAt.localeCompare(b.endsAt)) },
    { status: "upcoming", label: "Upcoming", meetings: occurrences.filter((item) => meetingStatus(item, now) === "upcoming").sort((a, b) => a.startsAt.localeCompare(b.startsAt)) },
    { status: "completed", label: "Completed", meetings: occurrences.filter((item) => meetingStatus(item, now) === "completed").sort((a, b) => b.startsAt.localeCompare(a.startsAt)) },
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
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeZone: deviceTimeZone() }).format(new Date(value));
}

export function formatMeetingDay(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: deviceTimeZone() }).format(new Date(value));
}

export function formatMeetingTime(meeting: Meeting) {
  const timeZone = deviceTimeZone();
  const options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone };
  const formatter = new Intl.DateTimeFormat(undefined, options);
  const zoneLabel = new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: "short" }).formatToParts(new Date(meeting.startsAt)).find((part) => part.type === "timeZoneName")?.value ?? timeZone;
  return `${formatter.format(new Date(meeting.startsAt))} – ${formatter.format(new Date(meeting.endsAt))} (${zoneLabel})`;
}
