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

export function meetingStatus(meeting: Meeting, now = Date.now()) {
  const start = new Date(meeting.startsAt).getTime();
  const end = new Date(meeting.endsAt).getTime();
  return now >= end ? "completed" : now >= start ? "ongoing" : "upcoming";
}

export function meetingJoinVisible(meeting: Meeting, now = Date.now()) {
  return meeting.meetingType !== "onsite" && Boolean(meeting.meetingUrl) && now >= new Date(meeting.startsAt).getTime() - 60 * 60 * 1000 && now < new Date(meeting.endsAt).getTime();
}

export function formatMeetingDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date(value));
}

export function formatMeetingTime(meeting: Meeting) {
  const options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${new Intl.DateTimeFormat(undefined, options).format(new Date(meeting.startsAt))} – ${new Intl.DateTimeFormat(undefined, options).format(new Date(meeting.endsAt))}`;
}
