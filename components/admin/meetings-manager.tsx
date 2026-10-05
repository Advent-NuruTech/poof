"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/sign-in";
import { endAdminSession } from "@/lib/admin-session";
import { formatMeetingDate, formatMeetingTime, type Meeting } from "@/lib/meetings";

const blank = { title: "", description: "", posterUrl: "", date: "", start: "", end: "", meetingUrl: "" };
function localDateTime(date: string, time: string) { return new Date(`${date}T${time}`).toISOString(); }

export default function MeetingsManager() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => onAuthStateChanged(auth, (current) => { setUser(current); setReady(true); }), []);
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
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

  async function createMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    try {
      const startsAt = localDateTime(form.date, form.start);
      const endsAt = localDateTime(form.date, form.end);
      if (new Date(endsAt) <= new Date(startsAt)) throw new Error("The end time must be later than the start time.");
      setBusy(true);
      await addDoc(collection(db, "meetings"), { title: form.title.trim(), description: form.description.trim(), posterUrl: form.posterUrl.trim(), startsAt, endsAt, meetingUrl: form.meetingUrl.trim() });
      setForm(blank); setNotice("Meeting published.");
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
    <div className="admin-content"><div className="admin-heading"><span className="eyebrow">MEETING SCHEDULE</span><h1>Zoom meetings</h1><p>Create a meeting with a poster, schedule, and join link.</p></div>
      {!ready ? <section className="admin-panel loading-card">Checking administrator access…</section> : !user || !isAdmin ? <section className="admin-panel sign-in-panel"><div className="panel-icon">◉</div><h2>{user ? "Admin access required" : "Administrator sign in"}</h2><p>{user ? "This Google account is not authorized to manage meetings." : "Sign in with your administrator Google account."}</p>{error && <p className="notice error-notice">{error}</p>}{!user && <button className="primary-button" onClick={() => void signInWithGoogle().catch((reason) => setError(reason instanceof Error ? reason.message : "Google sign-in failed."))}>Continue with Google</button>}</section> : <>
        <section className="admin-panel"><div className="section-heading"><div><span className="eyebrow">NEW MEETING</span><h2>Meeting details</h2></div><span className="secure-label">● Private admin access</span></div>
          <form className="meeting-admin-form" onSubmit={(event) => void createMeeting(event)}>
            <label>Title<input required maxLength={140} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Weekly Bible study"/></label>
            <label>Description <span>Optional</span><textarea rows={3} maxLength={1200} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="A few details about the meeting"/></label>
            <label>Poster image <span>Optional · upload to Cloudinary</span><input type="file" accept="image/*" disabled={uploadingPoster} onChange={(event) => void uploadPoster(event.target.files?.[0])}/></label>
            {form.posterUrl && <div className="meeting-poster-preview"><img src={form.posterUrl} alt="Meeting poster preview"/><button type="button" className="outline-button" onClick={() => setForm({ ...form, posterUrl: "" })}>Remove poster</button></div>}
            <label>Meeting link<input type="url" required value={form.meetingUrl} onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })} placeholder="https://zoom.us/j/…"/></label>
            <div className="meeting-time-fields"><label>Date<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })}/></label><label>Starts at<input required type="time" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })}/></label><label>Ends at<input required type="time" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })}/></label></div>
            {error && <p className="notice error-notice">{error}</p>}{notice && <p className="notice">{notice}</p>}
            <button className="primary-button" disabled={busy}>{busy ? "Publishing…" : "Publish meeting"}</button>
          </form>
        </section>
        <div className="channel-list-heading"><h2>Scheduled meetings <span>{meetings.length}</span></h2></div>
        {!meetings.length ? <section className="admin-panel empty-state"><h3>No meetings yet</h3><p>Published meetings will appear here.</p></section> : <div className="admin-channel-list">{meetings.map((meeting) => <article className="admin-channel" key={meeting.id}>{meeting.posterUrl && <img className="channel-avatar meeting-admin-poster" src={meeting.posterUrl} alt=""/>}<div className="channel-details"><div className="channel-title-row"><h3>{meeting.title}</h3></div><p>{formatMeetingDate(meeting.startsAt)} · {formatMeetingTime(meeting)}</p>{meeting.description && <small>{meeting.description}</small>}</div><div className="channel-actions"><button className="icon-action remove-action" title={`Delete ${meeting.title}`} onClick={() => { if (window.confirm(`Delete “${meeting.title}”?`)) void deleteDoc(doc(db, "meetings", meeting.id)).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not delete meeting.")); }}>×</button></div></article>)}</div>}
      </>}
    </div>
  </main>;
}
