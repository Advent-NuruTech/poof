export type Meeting = {
  id: string;
  title: string;
  description?: string;
  posterUrl?: string;
  startsAt: string;
  endsAt: string;
  meetingUrl: string;
};

export function meetingStatus(meeting: Meeting, now = Date.now()) {
  const start = new Date(meeting.startsAt).getTime();
  const end = new Date(meeting.endsAt).getTime();
  return now >= start && now < end ? "live" : now < start ? "upcoming" : "past";
}

export function formatMeetingDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date(value));
}

export function formatMeetingTime(meeting: Meeting) {
  const options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${new Intl.DateTimeFormat(undefined, options).format(new Date(meeting.startsAt))} – ${new Intl.DateTimeFormat(undefined, options).format(new Date(meeting.endsAt))}`;
}
