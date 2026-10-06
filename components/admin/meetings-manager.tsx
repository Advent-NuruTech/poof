"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, updateDoc, deleteField } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/sign-in";
import { endAdminSession } from "@/lib/admin-session";
import { deviceTimeZone, formatMeetingDate, formatMeetingTime, type Meeting } from "@/lib/meetings";

const blank = { title: "", description: "", posterUrl: "", date: "", start: "", end: "", meetingType: "online" as "online" | "onsite", meetingUrl: "", venue: "", repeats: false, repeatDays: [] as number[], repeatUntil: "never" as "never" | "date", untilDate: "" };
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function localDateTime(date: string, time: string) { return new Date(`${date}T${time}`).toISOString(); }
function meetingForm(meeting: Meeting) {
  const start = new Date(meeting.startsAt);
  const end = new Date(meeting.endsAt);
  const localStart = new Date(start.getTime() - start.getTimezoneOffset() * 60_000).toISOString();
  const localEnd = new Date(end.getTime() - end.getTimezoneOffset() * 60_000).toISOString();
  return {
    title: meeting.title, description: meeting.description ?? "", posterUrl: meeting.posterUrl ?? "",
    date: localStart.slice(0, 10), start: localStart.slice(11, 16), end: localEnd.slice(11, 16),
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

  useEffect(() => onAuthStateChanged(auth, (current) => { setUser(current); setReady(true); if (!current) setIsAdmin(false); }), []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const adminRef = doc(db, "admins", user.uid);
    getDoc(adminRef).then(async (snapshot) => {
      const expiresAt = snapshot.data()?.expiresAt?.toMillis?.() ?? 0;
      if (active) setIsAdmin(snapshot.exists() && snapshot.data()?.enabled === true && expiresAt > Date.now());
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not verify admin access."); });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(collection(db, "meetings"), (snapshot) => setMeetings(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Meeting).sort((a, b) => a.startsAt.localeCompare(b.startsAt))), (reason) => setError(reason.message));
  }, [isAdmin]);

  function editMeeting(meeting: Meeting) {
    setForm(meetingForm(meeting));
    setEditingId(meeting.id);
    setError(""); setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setForm(blank); setEditingId(null); setError(""); setNotice("");
  }

  async function saveMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || uploadingPoster) return;
    setError(""); setNotice("");
    try {
      const startsAt = localDateTime(form.date, form.start);
      const endsAt = localDateTime(form.date, form.end);
      if (new Date(endsAt) <= new Date(startsAt)) throw new Error("The end time must be later than the start time.");
      if (form.repeats && !form.repeatDays.length) throw new Error("Choose at least one day for a repeating meeting.");
      if (form.repeats && form.repeatUntil === "date" && !form.untilDate) throw new Error("Choose the date when this repeating meeting ends.");
      if (form.repeats && form.repeatUntil === "date" && form.untilDate < form.date) throw new Error("The repeat end date must be on or after the first meeting date.");
      setBusy(true);
      if (form.meetingType === "onsite" && !form.venue.trim()) throw new Error("Enter the meeting venue.");
      const recurrence = form.repeats ? { frequency: "weekly" as const, days: form.repeatDays, ...(form.repeatUntil === "date" ? { until: form.untilDate } : {}) } : undefined;
      const data = { title: form.title.trim(), description: form.description.trim(), posterUrl: form.posterUrl.trim(), startsAt, endsAt, timeZone: deviceTimeZone(), meetingType: form.meetingType, meetingUrl: form.meetingType === "online" ? form.meetingUrl.trim() : "", venue: form.meetingType === "onsite" ? form.venue.trim() : "" };
      if (editingId) {
        await updateDoc(doc(db, "meetings", editingId), { ...data, recurrence: recurrence ?? deleteField() });
        setNotice("Meeting updated.");
      } else {
        await addDoc(collection(db, "meetings"), { ...data, ...(recurrence ? { recurrence } : {}) });
        setNotice("Meeting published.");
      }
      setForm(blank); setEditingId(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save this meeting."); }
    finally { setBusy(false); }
  }

  async function uploadPoster(file: File | undefined) {
    if (!file) return;
    setError(""); setNotice(""); setUploadingPoster(true);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Sign in again to upload a poster.");
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/meetings/poster", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
      const result = await response.json() as { secureUrl?: string; error?: string };
      if (!response.ok || !result.secureUrl) throw new Error(result.error ?? "Poster upload failed.");
      setForm((current) => ({ ...current, posterUrl: result.secureUrl! }));
      setNotice("Poster uploaded to Cloudinary.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Poster upload failed."); }
    finally { setUploadingPoster(false); }
  }

  return <main className="admin-shell"><header className="admin-top"><a className="back-link" href="/admin">← Channel admin</a><span className="admin-mark">POOF <span>MEETINGS</span></span><button className="text-button" onClick={() => void endAdminSession().finally(() => signOut(auth))}>Sign out</button><a className="text-button" href="/meetings" target="_blank">View public page ↗</a></header>
    <div className="admin-content"><div className="admin-heading"><span className="eyebrow">MEETING SCHEDULE</span><h1>Zoom meetings</h1><p>Create or edit a meeting with a poster, schedule, and join link.</p></div>
      {!ready ? <section className="admin-panel loading-card">Checking administrator access…</section> : !user || !isAdmin ? <section className="admin-panel sign-in-panel"><div className="panel-icon">◉</div><h2>{user ? "Admin access required" : "Administrator sign in"}</h2><p>{user ? "This Google account is not authorized to manage meetings." : "Sign in with your administrator Google account."}</p>{error && <p className="notice error-notice">{error}</p>}{!user && <button className="primary-button" onClick={() => void signInWithGoogle().catch((reason) => setError(reason instanceof Error ? reason.message : "Google sign-in failed."))}>Continue with Google</button>}</section> : <>
        <section className="admin-panel"><div className="section-heading"><div><span className="eyebrow">{editingId ? "EDIT MEETING" : "NEW MEETING"}</span><h2>Meeting details</h2></div><span className="secure-label">● Private admin access</span></div>
          <form className="meeting-admin-form" onSubmit={(event) => void saveMeeting(event)}>
            <label>Title<input required maxLength={140} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Weekly Bible study"/></label>
            <label>Description <span>Optional</span><textarea rows={3} maxLength={1200} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="A few details about the meeting"/></label>
            <label>Poster image <span>Optional · upload to Cloudinary</span><input type="file" accept="image/*" disabled={uploadingPoster} onChange={(event) => void uploadPoster(event.target.files?.[0])}/></label>
            {form.posterUrl && <div className="meeting-poster-preview"><img src={form.posterUrl} alt="Meeting poster preview"/><button type="button" className="outline-button" onClick={() => setForm({ ...form, posterUrl: "" })}>Remove poster</button></div>}
            <label>Meeting format<select value={form.meetingType} onChange={(event) => setForm({ ...form, meetingType: event.target.value as "online" | "onsite" })}><option value="online">Online</option><option value="onsite">Onsite</option></select></label>
            {form.meetingType === "online" ? <label>Meeting link <span>Optional · visible one hour before start</span><input type="url" value={form.meetingUrl} onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })} placeholder="https://zoom.us/j/…"/></label> : <label>Venue<input required value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} placeholder="Address or venue name"/></label>}
            <div className="meeting-time-fields"><label>Date<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })}/></label><label>Starts at<input required type="time" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })}/></label><label>Ends at<input required type="time" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })}/></label></div>
            <p className="meeting-timezone-note">Scheduling in your device timezone: <strong>{deviceTimeZone()}</strong>. Visitors will see this meeting in their own local timezone.</p>
            <fieldset className="meeting-recurrence"><legend>Does this repeat?</legend><label className="repeat-choice"><input type="radio" name="repeats" checked={!form.repeats} onChange={() => setForm({ ...form, repeats: false })}/> No</label><label className="repeat-choice"><input type="radio" name="repeats" checked={form.repeats} onChange={() => setForm({ ...form, repeats: true })}/> Yes</label>{form.repeats && <div className="repeat-options"><label>Repeat<select value="weekly" disabled><option value="weekly">Weekly</option></select></label><div><span className="repeat-label">Days</span><div className="repeat-days">{weekdays.map((day, index) => <label key={day}><input type="checkbox" checked={form.repeatDays.includes(index)} onChange={() => setForm({ ...form, repeatDays: form.repeatDays.includes(index) ? form.repeatDays.filter((value) => value !== index) : [...form.repeatDays, index] })}/>{day}</label>)}</div></div><label>Until<select value={form.repeatUntil} onChange={(event) => setForm({ ...form, repeatUntil: event.target.value as "never" | "date" })}><option value="never">Never</option><option value="date">A date</option></select></label>{form.repeatUntil === "date" && <label>End date<input required type="date" min={form.date || undefined} value={form.untilDate} onChange={(event) => setForm({ ...form, untilDate: event.target.value })}/></label>}</div>}</fieldset>
            {error && <p className="notice error-notice">{error}</p>}{notice && <p className="notice">{notice}</p>}
            <button className="primary-button" disabled={busy || uploadingPoster}>{busy ? "Saving…" : editingId ? "Save changes" : "Publish meeting"}</button>{editingId && <button type="button" className="outline-button" disabled={busy || uploadingPoster} onClick={cancelEdit}>Cancel edit</button>}
          </form>
        </section>
        <div className="channel-list-heading"><h2>Scheduled meetings <span>{meetings.length}</span></h2></div>
        {!meetings.length ? <section className="admin-panel empty-state"><h3>No meetings yet</h3><p>Published meetings will appear here.</p></section> : <div className="admin-channel-list">{meetings.map((meeting) => <article className="admin-channel" key={meeting.id}>{meeting.posterUrl && <img className="channel-avatar meeting-admin-poster" src={meeting.posterUrl} alt=""/>}<div className="channel-details"><div className="channel-title-row"><h3>{meeting.title}</h3></div><p>{formatMeetingDate(meeting.startsAt)} · {formatMeetingTime(meeting)}</p>{meeting.description && <small>{meeting.description}</small>}</div><div className="channel-actions"><button type="button" className="outline-button" disabled={busy || uploadingPoster} onClick={() => editMeeting(meeting)}>Edit</button><button className="icon-action remove-action" title={`Delete ${meeting.title}`} onClick={() => { if (window.confirm(`Delete “${meeting.title}”?`)) void deleteDoc(doc(db, "meetings", meeting.id)).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not delete meeting.")); }}>×</button></div></article>)}</div>}
      </>}
    </div>
  </main>;
}
