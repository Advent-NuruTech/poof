"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { auth, db } from "@/lib/firebase";
import { endAdminSession } from "@/lib/admin-session";
import { signInWithGoogle } from "@/lib/sign-in";
import { readApiResponse } from "@/lib/api-response";
import { automaticPreviewText, sanitizeRichText } from "@/lib/rich-text";
import RichTextEditor from "@/components/admin/rich-text-editor";

type MailingTab = "meeting" | "newsletter";
type CampaignForm = {
  subject: string;
  headline: string;
  preheader: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  videoUrl: string;
  startsAt: string;
  endsAt: string;
  repeat: "once" | "daily" | "weekly" | "monthly";
};
type MailingRecord = { id: string; [key: string]: unknown };
type MailingData = {
  members: MailingRecord[];
  subscribers: MailingRecord[];
  schedules: MailingRecord[];
  history: MailingRecord[];
  counts: { verified: number; pending: number; active: number; unsubscribed: number };
};
type ApiResult = { error?: string; status?: string; sent?: number; failed?: number };
type DateLike = { _seconds?: number; seconds?: number } | string | null | undefined;

const initialCampaign: CampaignForm = {
  subject: "", headline: "", preheader: "", body: "",
  buttonLabel: "Join the meeting", buttonUrl: "", videoUrl: "",
  startsAt: "", endsAt: "", repeat: "once",
};
const tabs: Array<{ id: MailingTab; label: string }> = [
  { id: "meeting", label: "Online meeting members" },
  { id: "newsletter", label: "Newsletter" },
];

function dateLabel(value: DateLike) {
  let date: Date | null = null;
  if (typeof value === "string") date = new Date(value);
  else if (value && typeof value === "object") {
    const seconds = value._seconds ?? value.seconds;
    if (typeof seconds === "number") date = new Date(seconds * 1000);
  }
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString() : "Recently";
}

function videoId(value: string) {
  return value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)?.[1] ?? "";
}

function localDateTime(value: unknown) {
  let date: Date | null = null;
  if (typeof value === "string") date = new Date(value);
  else if (value && typeof value === "object") {
    const timestamp = value as { _seconds?: number; seconds?: number };
    const seconds = timestamp._seconds ?? timestamp.seconds;
    if (typeof seconds === "number") date = new Date(seconds * 1000);
  }
  if (!date || !Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function MailingManager() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<MailingTab>("meeting");
  const [campaign, setCampaign] = useState<CampaignForm>(initialCampaign);
  const [preheaderEdited, setPreheaderEdited] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [data, setData] = useState<MailingData>({ members: [], subscribers: [], schedules: [], history: [], counts: { verified: 0, pending: 0, active: 0, unsubscribed: 0 } });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => onAuthStateChanged(auth, (current) => {
    setUser(current);
    setReady(true);
    setAuthorized(false);
  }), []);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    if (!user) throw new Error("Sign in to manage mailing.");
    const token = await user.getIdToken();
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(path, {
      ...init,
      headers,
      cache: "no-store",
    });
    return readApiResponse<ApiResult>(response, "Mailing request");
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/mailing", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await readApiResponse<MailingData & { error?: string }>(response, "Could not load mailing lists");
      setData(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load mailing lists.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getDoc(doc(db, "admins", user.uid)).then(async (snapshot) => {
      const expiresAt = snapshot.data()?.expiresAt?.toMillis?.() ?? 0;
      const allowed = snapshot.exists() && snapshot.data()?.enabled === true && expiresAt > Date.now();
      if (!active) return;
      setAuthorized(allowed);
      if (allowed) await refresh();
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not verify administrator access.");
    });
    return () => { active = false; };
  }, [user, refresh]);

  const currentMembers = useMemo(() => tab === "meeting" ? data.members : data.subscribers, [data.members, data.subscribers, tab]);
  const activeCount = tab === "meeting" ? data.counts.verified : data.counts.active;
  const secondaryCount = tab === "meeting" ? data.counts.pending : data.counts.unsubscribed;
  const currentSchedules = data.schedules.filter((schedule) => schedule.kind === tab);
  const currentHistory = data.history.filter((item) => item.kind === tab);

  function updateCampaign(field: Exclude<keyof CampaignForm, "repeat">, value: string) {
    setCampaign((current) => ({ ...current, [field]: value }));
    if (field === "preheader") setPreheaderEdited(true);
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice(""); setBusy(true);
    try {
      const result = await request("/api/mailing", { method: "POST", body: JSON.stringify({ action: "add-member", email: memberEmail }) });
      setMemberEmail("");
      setNotice(result.status === "already-verified" ? "That email is already verified." : "Email added and marked verified.");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add email.");
    } finally { setBusy(false); }
  }

  async function updateRecord(collection: "members" | "schedules", id: string, status: string) {
    setError(""); setNotice(""); setBusy(true);
    try {
      await request("/api/mailing", { method: "PATCH", body: JSON.stringify({ collection, id, status }) });
      if (collection === "schedules" && id === editingScheduleId) setEditingScheduleId(null);
      setNotice(status === "verified" ? "Email verified." : status === "cancelled" ? "Schedule cancelled." : "Email removed.");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the mailing record.");
    } finally { setBusy(false); }
  }

  async function submitCampaign(event: FormEvent<HTMLFormElement>, action: "send" | "schedule") {
    event.preventDefault();
    setError(""); setNotice(""); setBusy(true);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const payload = {
        action, kind: tab, ...campaign,
        preheader: preheaderEdited ? campaign.preheader : "",
        startsAt: campaign.startsAt ? new Date(campaign.startsAt).toISOString() : "",
        endsAt: campaign.endsAt ? new Date(campaign.endsAt).toISOString() : "",
        timeZone,
      };
      const result = action === "schedule" && editingScheduleId
        ? await request("/api/mailing", { method: "PATCH", body: JSON.stringify({ ...payload, collection: "schedules", id: editingScheduleId, status: "scheduled" }) })
        : await request("/api/mailing", { method: "POST", body: JSON.stringify(payload) });
      if (action === "send") {
        setNotice(`Email sent to ${result.sent ?? 0} ${tab === "meeting" ? "verified members" : "subscribers"}${result.failed ? `; ${result.failed} failed` : ""}.`);
      } else {
        setNotice(editingScheduleId ? "Your scheduled email was updated." : "Your email is scheduled. The system will send it automatically.");
        setEditingScheduleId(null);
        setCampaign(initialCampaign);
        setPreheaderEdited(false);
      }
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The email could not be processed.");
    } finally { setBusy(false); }
  }

  function editSchedule(schedule: MailingRecord) {
    const repeat = schedule.repeat === "daily" || schedule.repeat === "weekly" || schedule.repeat === "monthly" ? schedule.repeat : "once";
    setEditingScheduleId(schedule.id);
    setCampaign({
      ...initialCampaign,
      subject: String(schedule.subject ?? ""),
      headline: String(schedule.headline ?? ""),
      preheader: String(schedule.preheader ?? ""),
      body: String(schedule.body ?? ""),
      buttonLabel: String(schedule.buttonLabel ?? ""),
      buttonUrl: String(schedule.buttonUrl ?? ""),
      videoUrl: String(schedule.videoUrl ?? ""),
      startsAt: localDateTime(schedule.nextSendAt),
      endsAt: localDateTime(schedule.endsAt),
      repeat,
    });
    setPreheaderEdited(Boolean(schedule.preheader));
    setError(""); setNotice("Editing this schedule. Save changes or cancel editing.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const previewVideo = videoId(campaign.videoUrl);
  const greeting = tab === "meeting" ? "Meeting invitation" : "Faith of the Pioneers newsletter";
  const automaticPreheader = automaticPreviewText(campaign.body);
  const previewPreheader = preheaderEdited ? campaign.preheader : automaticPreheader;

  return <main className="admin-shell mailing-admin">
    <header className="admin-top"><span className="admin-mark">POOF <span>MAILING</span></span><div className="admin-top-actions"><button className="text-button" onClick={() => void endAdminSession().finally(() => signOut(auth))}>Sign out</button></div></header>
    <div className="admin-content">
      <div className="admin-heading"><span className="eyebrow">COMMUNICATIONS</span><h1>Mailing system</h1><p>Manage meeting contacts, create polished newsletters, and automate delivery with Resend.</p></div>
      {!ready ? <section className="admin-panel loading-card">Checking administrator access…</section>
        : !user || !authorized ? <section className="admin-panel sign-in-panel"><div className="panel-icon">✉</div><h2>{user ? "Admin access required" : "Administrator sign in"}</h2><p>{user ? "This account is not authorized to manage email." : "Sign in with your administrator Google account."}</p>{error && <p className="notice error-notice">{error}</p>}{!user && <button className="primary-button" onClick={() => void signInWithGoogle().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Google sign-in failed."))}>Continue with Google</button>}</section>
        : <>
          {error && <p className="notice error-notice" role="alert">{error}</p>}
          {notice && <p className="notice" role="status">{notice}</p>}
          <section className="mailing-stats">
            <article><span>{tab === "meeting" ? "Verified meeting emails" : "Active newsletter subscribers"}</span><strong>{activeCount.toLocaleString()}</strong></article>
            <article><span>{tab === "meeting" ? "Pending verification" : "Unsubscribed"}</span><strong>{secondaryCount.toLocaleString()}</strong></article>
            <article><span>Scheduled sends</span><strong>{currentSchedules.filter((item) => item.active === true).length.toLocaleString()}</strong></article>
          </section>
          <nav className="mailing-tabs" aria-label="Mailing lists">{tabs.map((item) => <button type="button" key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setEditingScheduleId(null); setCampaign(initialCampaign); setPreheaderEdited(false); setError(""); setNotice(""); }}>{item.label}</button>)}</nav>
          <section className="mailing-grid">
            <div className="mailing-people">
              <div className="mailing-section-heading"><div><span className="eyebrow">{tab === "meeting" ? "ONLINE MEETING MEMBERS" : "NEWSLETTER AUDIENCE"}</span><h2>{tab === "meeting" ? "Email list" : "Subscribers"}</h2></div><button className="text-button" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
              {tab === "meeting" && <form className="mailing-add-form" onSubmit={(event) => void addMember(event)}><label htmlFor="add-member-email">Add an email as verified</label><div><input id="add-member-email" type="email" required maxLength={254} value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="person@example.com"/><button className="primary-button" disabled={busy}>Add email</button></div></form>}
              {currentMembers.length > 0 && <p className="mailing-helper">Showing up to the 500 most recent addresses; sends always use the full verified or active audience.</p>}
              {!currentMembers.length ? <div className="mailing-empty">{loading ? "Loading email addresses…" : tab === "meeting" ? "No meeting requests yet. New requests will appear here as pending." : "No newsletter subscribers yet."}</div>
                : <div className="mailing-member-list">{currentMembers.map((member) => {
                  const status = String(member.status ?? "unknown");
                  return <article key={member.id}><div><strong>{String(member.email ?? "")}</strong><small>{String(member.name ?? (member.source === "admin" ? "Added by administrator" : "Subscriber"))} · {dateLabel(member.createdAt as DateLike)}</small></div><span className={`mailing-status ${status}`}>{status}</span>{tab === "meeting" && status !== "verified" && <button className="outline-button" disabled={busy} onClick={() => void updateRecord("members", member.id, "verified")}>Verify</button>}{tab === "meeting" && <button className="icon-action remove-action" aria-label={`Remove ${String(member.email ?? "email")}`} disabled={busy} onClick={() => void updateRecord("members", member.id, "delete")}>×</button>}</article>;
                })}</div>}
            </div>
            <div className="mailing-compose">
              <div className="mailing-section-heading"><div><span className="eyebrow">{tab === "meeting" ? "MEETING NOTIFICATION" : "NEWSLETTER EDITOR"}</span><h2>{tab === "meeting" ? "Compose an email" : "Create a newsletter"}</h2></div></div>
              <p className="mailing-helper">{tab === "meeting" ? "Only verified meeting members receive these messages. The join link becomes a secure, styled button." : "A responsive, inbox-friendly template includes your featured story, linked video preview, and unsubscribe link."}</p>
              <form className="mailing-form" onSubmit={(event) => void submitCampaign(event, "send")}>
                <label>Subject<input required maxLength={180} value={campaign.subject} onChange={(event) => updateCampaign("subject", event.target.value)} placeholder={tab === "meeting" ? "This week's online meeting" : "A note from Faith of the Pioneers"}/></label>
                <label>Headline<input required maxLength={180} value={campaign.headline} onChange={(event) => updateCampaign("headline", event.target.value)} placeholder={tab === "meeting" ? "You're invited to join us" : "Encouragement for your week"}/></label>
                <label>Inbox preview text<input maxLength={180} value={preheaderEdited ? campaign.preheader : automaticPreheader} onChange={(event) => updateCampaign("preheader", event.target.value)} placeholder="Automatically generated from your message"/><small>Suggested from your message. Edit it here if you prefer different text.</small></label>
                {preheaderEdited && <button type="button" className="text-button" onClick={() => { setCampaign((current) => ({ ...current, preheader: "" })); setPreheaderEdited(false); }}>Use message preview</button>}
                <div className="mailing-rich-field"><strong>Message</strong><RichTextEditor label="Message" placeholder={tab === "meeting" ? "Write your meeting announcement…" : "Write your newsletter…"} value={campaign.body} maxTextLength={12000} onChange={(value) => updateCampaign("body", value)} className="rich-editor-compact"/></div>
                <label>{tab === "meeting" ? "Meeting link (HTTPS)" : "Button link (optional)"}<input type="url" required={tab === "meeting"} value={campaign.buttonUrl} onChange={(event) => updateCampaign("buttonUrl", event.target.value)} placeholder="https://…"/></label>
                {tab === "newsletter" && <><label>Button label<input maxLength={80} value={campaign.buttonLabel} onChange={(event) => updateCampaign("buttonLabel", event.target.value)} placeholder="Read the full story"/></label><label>Featured video URL (optional)<input type="url" value={campaign.videoUrl} onChange={(event) => updateCampaign("videoUrl", event.target.value)} placeholder="https://www.youtube.com/watch?v=…"/><small>Email apps block embedded playback; subscribers get a clickable video preview.</small></label>{campaign.videoUrl && (previewVideo ? <div className="mailing-video-preview"><img src={`https://img.youtube.com/vi/${previewVideo}/hqdefault.jpg`} alt="Video thumbnail preview"/><span>Clickable video preview in your newsletter</span></div> : <div className="mailing-generic-video">▶ <span>Featured video preview</span></div>)}</>}
                <div className="mailing-form-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? "Sending…" : `Send to ${activeCount.toLocaleString()}`}</button></div>
              </form>
              <form className="mailing-schedule-form" onSubmit={(event) => void submitCampaign(event, "schedule")}>
                <h3>Schedule automatic delivery</h3>
                <p className="mailing-helper">Hobby plan: the scheduler checks once a day around 09:00 UTC. Vercel may start that check up to 59 minutes before or after; emails scheduled after it may wait until the next daily check.</p>
                <div className="mailing-schedule-fields"><label>First send<input type="datetime-local" required value={campaign.startsAt} onChange={(event) => updateCampaign("startsAt", event.target.value)}/></label><label>Repeat<select value={campaign.repeat} onChange={(event) => { const value = event.target.value; if (value === "once" || value === "daily" || value === "weekly" || value === "monthly") setCampaign((current) => ({ ...current, repeat: value })); }}><option value="once">One time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label></div>
                {campaign.repeat !== "once" && <label>Repeat through (optional)<input type="datetime-local" value={campaign.endsAt} onChange={(event) => updateCampaign("endsAt", event.target.value)}/><small>Leave blank to repeat until you cancel the schedule.</small></label>}
                {editingScheduleId && <button type="button" className="text-button" onClick={() => { setEditingScheduleId(null); setCampaign(initialCampaign); setPreheaderEdited(false); setNotice(""); }}>Cancel editing</button>}
                <button className="outline-button" disabled={busy}>{busy ? "Saving…" : editingScheduleId ? "Update schedule" : "Schedule email"}</button>
              </form>
              <aside className="mailing-template-preview"><span className="eyebrow">TEMPLATE PREVIEW</span><div><small>{greeting} · {previewPreheader || "Your preview text appears here."}</small><h3>{campaign.headline || "Your headline appears here"}</h3>{campaign.body ? <div className="mailing-preview-body" dangerouslySetInnerHTML={{ __html: sanitizeRichText(campaign.body) }}/>: <p>Your email message preview will appear here as you write.</p>}{campaign.buttonUrl && <span className="mailing-preview-button">{campaign.buttonLabel || (tab === "meeting" ? "Join the meeting" : "Learn more")}</span>}{previewVideo ? <img src={`https://img.youtube.com/vi/${previewVideo}/hqdefault.jpg`} alt="Featured video thumbnail"/> : campaign.videoUrl && <div className="mailing-generic-video">▶ <span>Featured video preview</span></div>}</div></aside>
            </div>
          </section>
          <section className="mailing-history">
            <div className="mailing-section-heading"><div><span className="eyebrow">AUTOMATION & DELIVERY</span><h2>Scheduled emails</h2></div></div>
            {!currentSchedules.length ? <div className="mailing-empty">No scheduled emails for this list.</div> : currentSchedules.map((schedule) => <article className="mailing-history-row" key={schedule.id}><div><strong>{String(schedule.subject ?? "Email")}</strong><small>{String(schedule.repeat ?? "once")} · Next send {dateLabel(schedule.nextSendAt as DateLike)}{schedule.endsAt ? ` · Ends ${dateLabel(schedule.endsAt as DateLike)}` : ""}</small></div><span className={`mailing-status ${schedule.active ? "active" : "completed"}`}>{String(schedule.status ?? (schedule.active ? "scheduled" : "completed"))}</span>{schedule.active === true && <><button className="outline-button" disabled={busy} onClick={() => editSchedule(schedule)}>Edit</button><button className="outline-button" disabled={busy} onClick={() => void updateRecord("schedules", schedule.id, "cancelled")}>Cancel</button></>}</article>)}
          </section>
          <section className="mailing-history">
            <div className="mailing-section-heading"><div><span className="eyebrow">RESEND DELIVERY RECORDS</span><h2>Email history</h2></div></div>
            {!currentHistory.length ? <div className="mailing-empty">Sent newsletters and meeting notifications will be listed here.</div> : currentHistory.map((item) => <article className="mailing-history-row" key={item.id}><div><strong>{String(item.subject ?? "Email")}</strong><small>{dateLabel(item.sentAt as DateLike)} · {String(item.sent ?? 0)} sent · {String(item.failed ?? 0)} failed</small></div><span className="mailing-status completed">{String(item.kind ?? "email")}</span></article>)}
          </section>
        </>}
    </div>
  </main>;
}
