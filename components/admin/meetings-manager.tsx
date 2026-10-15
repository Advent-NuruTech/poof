"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, query, updateDoc, deleteField } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { auth, db } from "@/lib/firebase";
import { endAdminSession } from "@/lib/admin-session";
import { isAdminIdentity } from "@/lib/admin-access";
import { deviceTimeZone, formatMeetingDate, formatMeetingTime, type Meeting } from "@/lib/meetings";
import { readApiResponse } from "@/lib/api-response";
import RichTextEditor from "@/components/admin/rich-text-editor";
import { sanitizeRichText } from "@/lib/rich-text";

const blank = { title: "", description: "", posterUrl: "", date: "", start: "", end: "", timeZone: "", meetingType: "online" as "online" | "onsite", meetingUrl: "", venue: "", repeats: false, repeatDays: [] as number[], repeatUntil: "never" as "never" | "date", untilDate: "" };
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const timeZoneStorageKey = "poof-meeting-time-zone";
const timeZones = (() => {
  try { return ["UTC", ...Intl.supportedValuesOf("timeZone")]; }
  catch { return ["UTC", "America/Los_Angeles", "America/New_York", "America/Chicago", "Europe/London", "Europe/Paris", "Africa/Nairobi", "Asia/Dubai", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"]; }
})();
function preferredTimeZone() {
  try {
    const saved = window.localStorage.getItem(timeZoneStorageKey);
    if (saved && timeZones.includes(saved)) return saved;
  } catch { /* Storage may be disabled; use the browser's zone. */ }
  return deviceTimeZone();
}
function localDateTime(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    guess += target - Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  }
  return new Date(guess).toISOString();
}
function dateTimeInZone(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
function meetingForm(meeting: Meeting) {
  const timeZone = meeting.timeZone || deviceTimeZone();
  const localStart = dateTimeInZone(meeting.startsAt, timeZone);
  const localEnd = dateTimeInZone(meeting.endsAt, timeZone);
  return {
    title: meeting.title, description: meeting.description ?? "", posterUrl: meeting.posterUrl ?? "",
    date: localStart.date, start: localStart.time, end: localEnd.time, timeZone,
    meetingType: meeting.meetingType ?? "online", meetingUrl: meeting.meetingUrl ?? "", venue: meeting.venue ?? "",
    repeats: Boolean(meeting.recurrence), repeatDays: meeting.recurrence?.days ?? [],
    repeatUntil: meeting.recurrence?.until ? "date" as const : "never" as const, untilDate: meeting.recurrence?.until ?? "",
  };
}

export default function MeetingsManager() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => onAuthStateChanged(auth, (current) => { setUser(current); setReady(true); setForm((form) => form.timeZone ? form : { ...form, timeZone: preferredTimeZone() }); if (!current) setIsAdmin(false); }), []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const adminRef = doc(db, "admins", user.uid);
    getDoc(adminRef).then(async (snapshot) => {
      const admin = snapshot.data();
      if (active) setIsAdmin(snapshot.exists() && isAdminIdentity(user.uid, {
        enabled: admin?.enabled,
        expiresAt: admin?.expiresAt?.toMillis?.() ?? 0,
        inviteId: admin?.inviteId,
        codeHash: admin?.codeHash,
      }));
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not verify admin access."); });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    void getDocs(query(collection(db, "meetings"), limit(200))).then((snapshot) => {
      if (active) setMeetings(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Meeting).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load meetings."); });
    return () => { active = false; };
  }, [isAdmin]);

  function editMeeting(meeting: Meeting) {
    setForm(meetingForm(meeting));
    setEditingId(meeting.id);
    setError(""); setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setForm({ ...blank, timeZone: preferredTimeZone() }); setEditingId(null); setError(""); setNotice("");
  }

  async function refreshPublicCatalog() {
    const token = await user?.getIdToken();
    if (!token) throw new Error("Sign in again to refresh the public schedule.");
    const response = await fetch("/api/admin/catalog/revalidate", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    await readApiResponse<{ revalidated: boolean }>(response, "Public schedule refresh");
  }

  async function saveMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || uploadingPoster) return;
    setError(""); setNotice("");
    let saved = false;
    try {
      if (!form.timeZone) throw new Error("Choose the time zone for this meeting.");
      const timeZone = form.timeZone;
      const startsAt = localDateTime(form.date, form.start, timeZone);
      const endsAt = localDateTime(form.date, form.end, timeZone);
      if (new Date(endsAt) <= new Date(startsAt)) throw new Error("The end time must be later than the start time.");
      if (form.repeats && !form.repeatDays.length) throw new Error("Choose at least one day for a repeating meeting.");
      if (form.repeats && form.repeatUntil === "date" && !form.untilDate) throw new Error("Choose the date when this repeating meeting ends.");
      if (form.repeats && form.repeatUntil === "date" && form.untilDate < form.date) throw new Error("The repeat end date must be on or after the first meeting date.");
      setBusy(true);
      if (form.meetingType === "onsite" && !form.venue.trim()) throw new Error("Enter the meeting venue.");
      const recurrence = form.repeats ? { frequency: "weekly" as const, days: form.repeatDays, ...(form.repeatUntil === "date" ? { until: form.untilDate } : {}) } : undefined;
      const data = { title: form.title.trim(), description: sanitizeRichText(form.description).trim(), posterUrl: form.posterUrl.trim(), startsAt, endsAt, timeZone, meetingType: form.meetingType, meetingUrl: form.meetingType === "online" ? form.meetingUrl.trim() : "", venue: form.meetingType === "onsite" ? form.venue.trim() : "" };
      if (editingId) {
        await updateDoc(doc(db, "meetings", editingId), { ...data, recurrence: recurrence ?? deleteField() });
      } else {
        await addDoc(collection(db, "meetings"), { ...data, ...(recurrence ? { recurrence } : {}) });
      }
      saved = true;
      try { window.localStorage.setItem(timeZoneStorageKey, timeZone); } catch { /* Keep the meeting saved if browser storage is unavailable. */ }
      setForm({ ...blank, timeZone }); setEditingId(null);
      try {
        await refreshPublicCatalog();
        setNotice("Meeting saved. Public pages will refresh shortly.");
      } catch (reason) {
        setError(`Meeting saved, but public pages could not be refreshed: ${reason instanceof Error ? reason.message : "Unknown error."}`);
      }
    } catch (reason) { setError(saved ? "Meeting saved, but public pages could not be refreshed." : reason instanceof Error ? reason.message : "Could not save this meeting."); }
    finally { setBusy(false); }
  }

  async function removeMeeting(meeting: Meeting) {
    if (!window.confirm(`Delete “${meeting.title}”?`)) return;
    setError(""); setNotice("");
    try {
      await deleteDoc(doc(db, "meetings", meeting.id));
      try {
        await refreshPublicCatalog();
        setNotice("Meeting deleted. Public pages will refresh shortly.");
      } catch (reason) {
        setError(`Meeting deleted, but public pages could not be refreshed: ${reason instanceof Error ? reason.message : "Unknown error."}`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete meeting.");
    }
  }

  async function uploadPoster(file: File | undefined) {
    if (!file) return;
    setError(""); setNotice(""); setUploadingPoster(true);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Sign in again to upload a poster.");
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/meetings/poster", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
      const result = await readApiResponse<{ secureUrl?: string }>(response, "Poster upload");
      if (!result.secureUrl) throw new Error("Poster upload did not return a file URL.");
      setForm((current) => ({ ...current, posterUrl: result.secureUrl! }));
      setNotice("Poster uploaded to Cloudinary.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Poster upload failed."); }
    finally { setUploadingPoster(false); }
  }

  return <main className="admin-shell"><header className="admin-top"><a className="back-link" href="/poof/admin">← Channel admin</a><span className="admin-mark">POOF <span>MEETINGS</span></span><button className="text-button" onClick={() => void endAdminSession().then(() => signOut(auth)).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not sign out."))}>Sign out</button><a className="text-button" href="/meetings" target="_blank">View public page ↗</a></header>
    <div className="admin-content"><div className="admin-heading"><span className="eyebrow">MEETING SCHEDULE</span><h1>Zoom meetings</h1><p>Create or edit a meeting with a poster, schedule, and join link.</p></div>
      {!ready ? <section className="admin-panel loading-card">Checking administrator access…</section> : !user || !isAdmin ? <section className="admin-panel sign-in-panel"><div className="panel-icon">◉</div><h2>{user ? "Admin access required" : "Administrator sign in"}</h2><p>{user ? "This account is not authorized to manage meetings." : "Sign in with your administrator email and password."}</p>{error && <p className="notice error-notice">{error}</p>}<Link className="primary-button" href="/signin">Sign in</Link></section> : <>
        <section className="admin-panel"><div className="section-heading"><div><span className="eyebrow">{editingId ? "EDIT MEETING" : "NEW MEETING"}</span><h2>Meeting details</h2></div><span className="secure-label">● Private admin access</span></div>
          <form className="meeting-admin-form" onSubmit={(event) => void saveMeeting(event)}>
            <label>Title<input required maxLength={140} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Weekly Bible study"/></label>
            <div className="meeting-description-field"><strong>Description <span>Optional</span></strong><RichTextEditor label="Meeting description" placeholder="A few details about the meeting" value={form.description} maxTextLength={1200} onChange={(value) => setForm((current) => ({ ...current, description: value }))} className="rich-editor-compact"/></div>
            <label>Poster image <span>Optional · upload to Cloudinary</span><input type="file" accept="image/*" disabled={uploadingPoster} onChange={(event) => void uploadPoster(event.target.files?.[0])}/></label>
            {form.posterUrl && <div className="meeting-poster-preview"><img src={form.posterUrl} alt="Meeting poster preview"/><button type="button" className="outline-button" onClick={() => setForm({ ...form, posterUrl: "" })}>Remove poster</button></div>}
            <label>Meeting format<select value={form.meetingType} onChange={(event) => setForm({ ...form, meetingType: event.target.value as "online" | "onsite" })}><option value="online">Online</option><option value="onsite">Onsite</option></select></label>
            {form.meetingType === "online" ? <label>Meeting link <span>Optional · visible one hour before start</span><input type="url" value={form.meetingUrl} onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })} placeholder="https://zoom.us/j/…"/></label> : <label>Venue<input required value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} placeholder="Address or venue name"/></label>}
            <div className="meeting-timezone-picker"><label htmlFor="meeting-time-zone">Scheduling time zone<select id="meeting-time-zone" required value={form.timeZone || deviceTimeZone()} onChange={(event) => setForm({ ...form, timeZone: event.target.value })}>{!timeZones.includes(form.timeZone || deviceTimeZone()) && <option value={form.timeZone}>{form.timeZone}</option>}{timeZones.map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}</select></label></div>
            <div className="meeting-time-fields"><label>Date<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })}/></label><label>Starts at<input required type="time" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })}/></label><label>Ends at<input required type="time" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })}/></label></div>
            <p className="meeting-timezone-note">Meeting times are scheduled in <strong>{form.timeZone || deviceTimeZone()}</strong>. Everyone will see the corresponding time in their own local timezone. Your choice is saved on this device for next time.</p>
            <fieldset className="meeting-recurrence"><legend>Does this repeat?</legend><label className="repeat-choice"><input type="radio" name="repeats" checked={!form.repeats} onChange={() => setForm({ ...form, repeats: false })}/> No</label><label className="repeat-choice"><input type="radio" name="repeats" checked={form.repeats} onChange={() => setForm({ ...form, repeats: true })}/> Yes</label>{form.repeats && <div className="repeat-options"><label>Repeat<select value="weekly" disabled><option value="weekly">Weekly</option></select></label><div><span className="repeat-label">Days</span><div className="repeat-days">{weekdays.map((day, index) => <label key={day}><input type="checkbox" checked={form.repeatDays.includes(index)} onChange={() => setForm({ ...form, repeatDays: form.repeatDays.includes(index) ? form.repeatDays.filter((value) => value !== index) : [...form.repeatDays, index] })}/>{day}</label>)}</div></div><label>Until<select value={form.repeatUntil} onChange={(event) => setForm({ ...form, repeatUntil: event.target.value as "never" | "date" })}><option value="never">Never</option><option value="date">A date</option></select></label>{form.repeatUntil === "date" && <label>End date<input required type="date" min={form.date || undefined} value={form.untilDate} onChange={(event) => setForm({ ...form, untilDate: event.target.value })}/></label>}</div>}</fieldset>
            {error && <p className="notice error-notice">{error}</p>}{notice && <p className="notice">{notice}</p>}
            <button className="primary-button" disabled={busy || uploadingPoster}>{busy ? "Saving…" : editingId ? "Save changes" : "Publish meeting"}</button>{editingId && <button type="button" className="outline-button" disabled={busy || uploadingPoster} onClick={cancelEdit}>Cancel edit</button>}
          </form>
        </section>
        <div className="channel-list-heading"><h2>Scheduled meetings <span>{meetings.length}</span></h2></div>
        {!meetings.length ? <section className="admin-panel empty-state"><h3>No meetings yet</h3><p>Published meetings will appear here.</p></section> : <div className="admin-channel-list">{meetings.map((meeting) => <article className="admin-channel" key={meeting.id}>{meeting.posterUrl && <img className="channel-avatar meeting-admin-poster" src={meeting.posterUrl} alt=""/>}<div className="channel-details"><div className="channel-title-row"><h3>{meeting.title}</h3></div><p>{formatMeetingDate(meeting.startsAt)} · {formatMeetingTime(meeting)}</p>{meeting.description && <div className="meeting-description-preview" dangerouslySetInnerHTML={{ __html: sanitizeRichText(meeting.description) }}/>}</div><div className="channel-actions"><button type="button" className="outline-button" disabled={busy || uploadingPoster} onClick={() => editMeeting(meeting)}>Edit</button><button className="icon-action remove-action" title={`Delete ${meeting.title}`} onClick={() => void removeMeeting(meeting)}>×</button></div></article>)}</div>}
      </>}
    </div>
  </main>;
}
