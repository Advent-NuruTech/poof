"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { auth, db } from "@/lib/firebase";
import { isAdminIdentity } from "@/lib/admin-access";
import { readApiResponse } from "@/lib/api-response";
import { automaticPreviewText, extractFeaturedVideoUrl, inlineVideoLinks, personalizedGreeting, sanitizeRichText } from "@/lib/rich-text";
import RichTextEditor from "@/components/admin/rich-text-editor";

type MailingTab = "meeting" | "newsletter";
type CampaignForm = {
  subject: string;
  letterTitle: string;
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
type AudienceMode = "all" | "selected" | "new";
type MailingRecord = { id: string; [key: string]: unknown };
type MailingData = {
  members: MailingRecord[];
  subscribers: MailingRecord[];
  schedules: MailingRecord[];
  history: MailingRecord[];
  counts: { verified: number; pending: number; active: number; unsubscribed: number; totalMembers: number; totalSubscribers: number; emailsSent: number };
};
type ApiResult = { error?: string; status?: string; sent?: number; failed?: number; imageUrl?: string };
type DateLike = { _seconds?: number; seconds?: number } | string | null | undefined;

const initialCampaign: CampaignForm = {
  subject: "", letterTitle: "Online meeting reminder", headline: "", preheader: "", body: "",
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

function isoDateTime(value: unknown) {
  let date: Date | null = null;
  if (typeof value === "string") date = new Date(value);
  else if (value && typeof value === "object") {
    const timestamp = value as { _seconds?: number; seconds?: number };
    const seconds = timestamp._seconds ?? timestamp.seconds;
    if (typeof seconds === "number") date = new Date(seconds * 1000);
  }
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

export default function MailingManager() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<MailingTab>("meeting");
  const [campaign, setCampaign] = useState<CampaignForm>(initialCampaign);
  const [preheaderEdited, setPreheaderEdited] = useState(false);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [audienceSince, setAudienceSince] = useState("");
  const [historySourceId, setHistorySourceId] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [focusedComposer, setFocusedComposer] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [data, setData] = useState<MailingData>({ members: [], subscribers: [], schedules: [], history: [], counts: { verified: 0, pending: 0, active: 0, unsubscribed: 0, totalMembers: 0, totalSubscribers: 0, emailsSent: 0 } });
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

  async function uploadCampaignImage(file: File) {
    if (!user) throw new Error("Sign in to upload mailing images.");
    const token = await user.getIdToken();
    const form = new FormData();
    form.set("image", file);
    const response = await fetch("/api/mailing/image", {
      method: "POST",
      headers: { Authorization: "Bearer".concat(" ", token) },
      body: form,
      cache: "no-store",
    });
    const result = await readApiResponse<ApiResult>(response, "Mailing image upload");
    if (!result.imageUrl) throw new Error("The image upload did not return an image URL.");
    return result.imageUrl;
  }

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/mailing", {       headers: { Authorization: "Bearer " + token }, cache: "no-store" });
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
      const admin = snapshot.data();
      const allowed = snapshot.exists() && isAdminIdentity(user.uid, {
        enabled: admin?.enabled,
        expiresAt: admin?.expiresAt?.toMillis?.() ?? 0,
        inviteId: admin?.inviteId,
        codeHash: admin?.codeHash,
      });
      if (!active) return;
      setAuthorized(allowed);
      if (allowed) await refresh();
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not verify administrator access.");
    });
    return () => { active = false; };
  }, [user, refresh]);

  const currentMembers = useMemo(() => tab === "meeting" ? data.members : data.subscribers, [data.members, data.subscribers, tab]);
  const visibleMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return currentMembers;
    return currentMembers.filter((member) =>
      [member.email, member.name, member.status, member.source]
        .some((value) => String(value ?? "").toLowerCase().includes(query))
    );
  }, [currentMembers, memberSearch]);
  const activeCount = tab === "meeting" ? data.counts.verified : data.counts.active;
  const secondaryCount = tab === "meeting" ? data.counts.pending : data.counts.unsubscribed;
  const currentSchedules = data.schedules.filter((schedule) => schedule.kind === tab);
  const currentHistory = data.history.filter((item) => item.kind === tab);
  const totalAudience = tab === "meeting" ? data.counts.totalMembers : data.counts.totalSubscribers;

  function updateCampaign(field: Exclude<keyof CampaignForm, "repeat">, value: string) {
    setCampaign((current) => ({ ...current, [field]: value }));
    if (field === "preheader") setPreheaderEdited(true);
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice(""); setBusy(true);
    try {
      const result = await request("/api/mailing", { method: "POST", body: JSON.stringify({ action: "add-member", email: memberEmail, name: memberName }) });
      setMemberEmail("");
      setMemberName("");
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
        action, kind: tab, ...campaign, videoUrl: effectiveVideoUrl,
        audienceMode,
        recipientIds: audienceMode === "selected" ? recipientIds : [],
        audienceSince: audienceMode === "new" ? audienceSince : "",
        preheader: preheaderEdited ? campaign.preheader : "",
        startsAt: campaign.startsAt ? new Date(campaign.startsAt).toISOString() : "",
        endsAt: campaign.endsAt ? new Date(campaign.endsAt).toISOString() : "",
        timeZone,
      };
      const result = action === "schedule" && editingScheduleId
        ? await request("/api/mailing", { method: "PATCH", body: JSON.stringify({ ...payload, collection: "schedules", id: editingScheduleId, status: "scheduled" }) })
        : await request("/api/mailing", { method: "POST", body: JSON.stringify(payload) });
      if (action === "send") {
          const failureSummary = result.failed ? "; " + result.failed + " failed" : "";
          setNotice("Email sent to " + (result.sent ?? 0) + " " + (tab === "meeting" ? "verified members" : "subscribers") + failureSummary + ".");
      } else {
        setNotice(editingScheduleId ? "Your scheduled email was updated." : "Your email is scheduled. The system will send it automatically.");
        setEditingScheduleId(null);
        setCampaign({ ...initialCampaign, letterTitle: tab === "meeting" ? "Online meeting reminder" : "A letter for your journey" });
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
    const savedAudience = schedule.audienceMode;
    setAudienceMode(savedAudience === "selected" || savedAudience === "new" ? savedAudience : "all");
    setRecipientIds(Array.isArray(schedule.recipientIds) ? schedule.recipientIds.filter((id): id is string => typeof id === "string") : []);
    setAudienceSince(typeof schedule.audienceSince === "string" ? schedule.audienceSince : "");
    setHistorySourceId("");
    setCampaign({
      ...initialCampaign,
      subject: String(schedule.subject ?? ""),
      letterTitle: String(schedule.letterTitle ?? (tab === "meeting" ? "Online meeting reminder" : "A letter for your journey")),
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

  function editHistory(item: MailingRecord) {
    const saved = item.campaign;
    if (!saved || typeof saved !== "object") {
      setError("This older email has no saved message to edit. Only new history entries include editable campaign content.");
      return;
    }
    const savedCampaign = saved as Record<string, unknown>;
    const kind = item.kind === "newsletter" ? "newsletter" : "meeting";
    const sentAt = isoDateTime(item.sentAt);
    setTab(kind);
    setEditingScheduleId(null);
    setHistorySourceId(item.id);
    setAudienceMode(sentAt ? "new" : "all");
    setRecipientIds([]);
    setAudienceSince(sentAt);
    setCampaign({
      ...initialCampaign,
      subject: String(savedCampaign.subject ?? item.subject ?? ""),
      letterTitle: String(savedCampaign.letterTitle ?? (kind === "meeting" ? "Online meeting reminder" : "A letter for your journey")),
      headline: String(savedCampaign.headline ?? item.headline ?? ""),
      preheader: String(savedCampaign.preheader ?? ""),
      body: String(savedCampaign.body ?? ""),
      buttonLabel: String(savedCampaign.buttonLabel ?? ""),
      buttonUrl: String(savedCampaign.buttonUrl ?? ""),
      videoUrl: String(savedCampaign.videoUrl ?? ""),
      startsAt: "",
      endsAt: "",
      repeat: "once",
    });
    setPreheaderEdited(Boolean(savedCampaign.preheader));
    setError("");
    setNotice(sentAt
      ? "Email loaded for editing. It is set to new members since the original send; choose another audience if needed."
      : "Email loaded for editing. Its original send date is unavailable, so the full eligible audience is selected.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function sendFromHistory(item: MailingRecord, mode: "all" | "new") {
    const message = mode === "new"
      ? "Send this saved email to eligible members who joined since it was first sent?"
      : "Resend this saved email to every currently eligible member?";
    if (!window.confirm(message)) return;
    setError(""); setNotice(""); setBusy(true);
    try {
      const result = await request("/api/mailing", {
        method: "POST",
        body: JSON.stringify({ action: "history-send", historyId: item.id, audienceMode: mode }),
      });
      const failureSummary = result.failed ? "; " + result.failed + " failed" : "";
      setNotice("Email sent to " + (result.sent ?? 0) + " recipients" + failureSummary + ".");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The saved email could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteHistory(item: MailingRecord) {
    if (!window.confirm("Delete this email history record? This does not recall emails already delivered.")) return;
    setError(""); setNotice(""); setBusy(true);
    try {
      await request("/api/mailing", { method: "PATCH", body: JSON.stringify({ collection: "history", id: item.id, status: "delete" }) });
      setNotice("Email history record deleted.");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete the email history record.");
    } finally {
      setBusy(false);
    }
  }

  function toggleRecipient(id: string) {
    setRecipientIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const inlineVideoUrl = extractFeaturedVideoUrl(campaign.body);
  const effectiveVideoUrl = inlineVideoUrl || campaign.videoUrl;
  const previewVideo = videoId(effectiveVideoUrl);
  const greeting = tab === "meeting" ? "Meeting invitation" : "Faith of the Pioneers newsletter";
  const greetingPreview = personalizedGreeting("Name");
  const automaticPreheader = automaticPreviewText(campaign.body);
  const previewPreheader = preheaderEdited ? campaign.preheader : automaticPreheader;

  return <main className={"admin-shell mailing-admin" + (focusedComposer ? " mailing-focus-mode" : "")}>
    <header className="admin-top"><span className="admin-mark">POOF <span>MAILING</span></span></header>
    <div className="admin-content">
      <div className="admin-heading"><span className="eyebrow">COMMUNICATIONS</span><h1>Mailing system</h1><p>Manage meeting contacts, create polished newsletters, and automate delivery with Resend.</p></div>
      {!ready ? <section className="admin-panel loading-card">Checking administrator access…</section>
        : !user || !authorized ? <section className="admin-panel sign-in-panel"><div className="panel-icon">✉</div><h2>{user ? "Admin access required" : "Administrator sign in"}</h2><p>{user ? "This account is not authorized to manage email." : "Sign in with your administrator email and password."}</p>{error && <p className="notice error-notice">{error}</p>}<Link className="primary-button" href="/signin">Sign in</Link></section>
        : <>
          {error && <p className="notice error-notice" role="alert">{error}</p>}
          {notice && <p className="notice" role="status">{notice}</p>}
          <nav className="mailing-quick-nav" aria-label="Mailing dashboard navigation">
            <button type="button" onClick={() => document.getElementById("mailing-audience")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Subscribers & members</button>
            <button type="button" onClick={() => document.getElementById("mailing-compose")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Compose message</button>
            <button type="button" onClick={() => document.getElementById("mailing-schedules")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Scheduled emails</button>
            <button type="button" onClick={() => document.getElementById("mailing-history")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Message history</button>
          </nav>
          <section className="mailing-stats">
            <article><span>{tab === "meeting" ? "Eligible members" : "Active subscribers"}</span><strong>{activeCount.toLocaleString()}</strong></article>
            <article><span>Total contacts</span><strong>{totalAudience.toLocaleString()}</strong><small>{secondaryCount.toLocaleString()} {tab === "meeting" ? "pending" : "unsubscribed"}</small></article>
            <article><span>Emails delivered</span><strong>{data.counts.emailsSent.toLocaleString()}</strong></article>
            <article><span>Scheduled sends</span><strong>{currentSchedules.filter((item) => item.active === true).length.toLocaleString()}</strong></article>
          </section>
          <nav className="mailing-tabs" aria-label="Mailing lists">{tabs.map((item) => <button type="button" key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setEditingScheduleId(null); setCampaign({ ...initialCampaign, letterTitle: item.id === "meeting" ? "Online meeting reminder" : "A letter for your journey" }); setPreheaderEdited(false); setAudienceMode("all"); setRecipientIds([]); setAudienceSince(""); setHistorySourceId(""); setError(""); setNotice(""); }}>{item.label}</button>)}</nav>
          <section className={"mailing-grid" + (focusedComposer ? " mailing-grid-focused" : "")}>
            <div className="mailing-people" id="mailing-audience">
              <div className="mailing-section-heading"><div><span className="eyebrow">{tab === "meeting" ? "ONLINE MEETING MEMBERS" : "NEWSLETTER AUDIENCE"}</span><h2>{tab === "meeting" ? "Email list" : "Subscribers"}</h2></div><button className="text-button" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
              {tab === "meeting" && <form className="mailing-add-form" onSubmit={(event) => void addMember(event)}><label htmlFor="add-member-name">First name (optional)<input id="add-member-name" type="text" maxLength={120} value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="Name"/></label><label htmlFor="add-member-email">Email address<input id="add-member-email" type="email" required maxLength={254} value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="person@example.com"/></label><button className="primary-button" disabled={busy}>Add email as verified</button></form>}
              <label className="mailing-search-label">Search this list
                <input type="search" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search email, name or status…" aria-label="Search subscribers and members" />
              </label>
              {currentMembers.length > 0 && <p className="mailing-helper mailing-list-count">Showing {visibleMembers.length.toLocaleString()} of {currentMembers.length.toLocaleString()} loaded contacts. All-audience sends include every eligible contact.</p>}
              {audienceMode === "selected" && currentMembers.length > 0 && <button type="button" className="text-button mailing-select-visible" onClick={() => {
                const eligible = currentMembers.filter((member) => member.status === (tab === "meeting" ? "verified" : "active")).map((member) => member.id);
                setRecipientIds(eligible.every((id) => recipientIds.includes(id)) ? [] : [...new Set([...recipientIds, ...eligible])].slice(0, 500));
              }}>Select or clear eligible addresses shown</button>}
              {!currentMembers.length ? <div className="mailing-empty">{loading ? "Loading email addresses…" : tab === "meeting" ? "No meeting requests yet. New requests will appear here as pending." : "No newsletter subscribers yet."}</div>
                : !visibleMembers.length ? <div className="mailing-empty">No contacts match “{memberSearch}”. Try another search.</div> : <div className="mailing-member-list">{visibleMembers.map((member) => {
                  const status = String(member.status ?? "unknown");
                  const eligible = status === (tab === "meeting" ? "verified" : "active");
                  return <article key={member.id}>{audienceMode === "selected" && <input className="mailing-recipient-check" type="checkbox" aria-label={"Select " + String(member.email ?? "email")} checked={recipientIds.includes(member.id)} disabled={!eligible || busy} onChange={() => toggleRecipient(member.id)}/>}<div><strong>{String(member.email ?? "")}</strong><small>{String(member.name ?? (member.source === "admin" ? "Added by administrator" : "Subscriber"))} · {dateLabel(member.createdAt as DateLike)}</small></div><span className={"mailing-status " + status}>{status}</span>{tab === "meeting" && status !== "verified" && <button className="outline-button" disabled={busy} onClick={() => void updateRecord("members", member.id, "verified")}>Verify</button>}{tab === "meeting" && <button className="icon-action remove-action" aria-label={"Remove " + String(member.email ?? "email")} disabled={busy} onClick={() => void updateRecord("members", member.id, "delete")}>×</button>}</article>;
                })}</div>}
            </div>
            <div className="mailing-compose" id="mailing-compose">
              <div className="mailing-section-heading"><div><span className="eyebrow">{tab === "meeting" ? "MEETING NOTIFICATION" : "NEWSLETTER EDITOR"}</span><h2>{tab === "meeting" ? "Compose an email" : "Create a newsletter"}</h2></div><button type="button" className="outline-button mailing-focus-toggle" aria-pressed={focusedComposer} onClick={() => setFocusedComposer((value) => !value)}>{focusedComposer ? "Exit focus mode" : "Focus editor"}</button></div>
              <p className="mailing-helper">{tab === "meeting" ? "Only verified meeting members receive these messages. The join link becomes a secure, styled button." : "A responsive, inbox-friendly template includes your featured story, linked video preview, and unsubscribe link."} Emails use the recipient&apos;s first name when available and greet them according to the send time.</p>
              <form className="mailing-form" onSubmit={(event) => void submitCampaign(event, "send")}>
                <label>Subject<input required maxLength={180} value={campaign.subject} onChange={(event) => updateCampaign("subject", event.target.value)} placeholder={tab === "meeting" ? "This week's online meeting" : "A note from Faith of the Pioneers"}/></label>
                <label>Letter header<input required maxLength={140} value={campaign.letterTitle} onChange={(event) => updateCampaign("letterTitle", event.target.value)} placeholder={tab === "meeting" ? "Online meeting reminder" : "A letter for your journey"}/><small>This is the short line beneath the ministry name in the email banner.</small></label>
                <label>Headline<input required maxLength={180} value={campaign.headline} onChange={(event) => updateCampaign("headline", event.target.value)} placeholder={tab === "meeting" ? "You're invited to join us" : "Encouragement for your week"}/></label>
                <label>Inbox preview text<input maxLength={180} value={preheaderEdited ? campaign.preheader : automaticPreheader} onChange={(event) => updateCampaign("preheader", event.target.value)} placeholder="Automatically generated from your message"/><small>Suggested from your message. Edit it here if you prefer different text.</small></label>
                {preheaderEdited && <button type="button" className="text-button" onClick={() => { setCampaign((current) => ({ ...current, preheader: "" })); setPreheaderEdited(false); }}>Use message preview</button>}
                <div className="mailing-rich-field"><strong>Message</strong><RichTextEditor label="Message" placeholder={tab === "meeting" ? "Write your meeting announcement…" : "Write your newsletter…"} value={campaign.body} maxTextLength={12000} allowImages onUploadImage={uploadCampaignImage} onChange={(value) => updateCampaign("body", value)} className="rich-editor-compact"/><small>Upload an image file or insert one from a public HTTPS URL. You can also paste a YouTube link for a clickable thumbnail at that position. Email apps do not support reliable embedded playback.</small></div>
                <label>{tab === "meeting" ? "Meeting link (HTTPS)" : "Button link (optional)"}<input type="url" required={tab === "meeting"} value={campaign.buttonUrl} onChange={(event) => updateCampaign("buttonUrl", event.target.value)} placeholder="https://…"/></label>
                {tab === "newsletter" && <><label>Button label<input maxLength={80} value={campaign.buttonLabel} onChange={(event) => updateCampaign("buttonLabel", event.target.value)} placeholder="Read the full story"/></label><label>Featured video URL (optional)<input type="url" value={campaign.videoUrl} onChange={(event) => updateCampaign("videoUrl", event.target.value)} placeholder="https://www.youtube.com/watch?v=…"/><small>Email apps block embedded playback; subscribers get a clickable video preview. A YouTube link in the message takes priority automatically.</small></label>{effectiveVideoUrl && (previewVideo ? <div className="mailing-video-preview"><img src={"https://img.youtube.com/vi/" + previewVideo + "/hqdefault.jpg"} alt="Video thumbnail preview"/><span>Clickable video preview in your newsletter</span></div> : <div className="mailing-generic-video">▶ <span>Featured video preview</span></div>)}</>}
                <label>Recipients<select value={audienceMode} onChange={(event) => {
                  const value = event.target.value;
                  if (value === "all" || value === "selected" || value === "new") setAudienceMode(value);
                }}><option value="all">All eligible {tab === "meeting" ? "members" : "subscribers"}</option><option value="selected">Custom selection (choose members below)</option>{audienceSince && <option value="new">{historySourceId ? "New members since the original email" : "New members since the saved date"}</option>}</select><small>{audienceMode === "all" ? activeCount.toLocaleString() + " eligible recipients across the full list." : audienceMode === "selected" ? recipientIds.length.toLocaleString() + " selected from up to 500 recent addresses shown below." : "Eligible contacts added after " + dateLabel(audienceSince) + "."}</small></label>
                {audienceMode === "selected" && recipientIds.length === 0 && <p className="mailing-audience-warning">Choose eligible email addresses from the list before sending or scheduling.</p>}
                <div className="mailing-form-actions"><button className="primary-button" type="submit" disabled={busy || (audienceMode === "selected" && recipientIds.length === 0)}>{busy ? "Sending…" : audienceMode === "selected" ? "Send to " + recipientIds.length.toLocaleString() + " selected" : audienceMode === "new" ? "Send to new members" : "Send to " + activeCount.toLocaleString()}</button></div>
              </form>
              <form className="mailing-schedule-form" onSubmit={(event) => void submitCampaign(event, "schedule")}>
                <h3>Schedule automatic delivery</h3>
                <p className="mailing-helper">Scheduled emails are checked every minute. This frequency requires Vercel Pro; Hobby plans allow scheduled checks only once per day.</p>
                <div className="mailing-schedule-fields"><label>First send<input type="datetime-local" required value={campaign.startsAt} onChange={(event) => updateCampaign("startsAt", event.target.value)}/></label><label>Repeat<select value={campaign.repeat} onChange={(event) => { const value = event.target.value; if (value === "once" || value === "daily" || value === "weekly" || value === "monthly") setCampaign((current) => ({ ...current, repeat: value })); }}><option value="once">One time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label></div>
                {campaign.repeat !== "once" && <label>Repeat through (optional)<input type="datetime-local" value={campaign.endsAt} onChange={(event) => updateCampaign("endsAt", event.target.value)}/><small>Leave blank to repeat until you cancel the schedule.</small></label>}
                {editingScheduleId && <button type="button" className="text-button" onClick={() => { setEditingScheduleId(null); setCampaign({ ...initialCampaign, letterTitle: tab === "meeting" ? "Online meeting reminder" : "A letter for your journey" }); setPreheaderEdited(false); setAudienceMode("all"); setRecipientIds([]); setAudienceSince(""); setHistorySourceId(""); setNotice(""); }}>Cancel editing</button>}
                <button className="outline-button" disabled={busy || (audienceMode === "selected" && recipientIds.length === 0)}>{busy ? "Saving…" : editingScheduleId ? "Update schedule" : "Schedule email"}</button>
              </form>
              <aside className="mailing-template-preview"><span className="eyebrow">TEMPLATE PREVIEW</span><div className="mailing-template-card"><header><img src="/images/foplogo.png" alt="Faith of the Pioneers"/><strong>FAITH OF THE PIONEERS</strong><span>{campaign.letterTitle || "Your letter header"}</span></header><section><small>{greeting} · {previewPreheader || "Your preview text appears here."}</small><p className="mailing-preview-greeting">{greetingPreview}</p><h3>{campaign.headline || "Your headline appears here"}</h3>{campaign.body ? <div className="mailing-preview-body" dangerouslySetInnerHTML={{ __html: inlineVideoLinks(sanitizeRichText(campaign.body)) }}/>: <p>Your email message preview will appear here as you write.</p>}{campaign.buttonUrl && <span className="mailing-preview-button">{campaign.buttonLabel || (tab === "meeting" ? "Join the meeting" : "Learn more")}</span>}{!inlineVideoUrl && (previewVideo ? <img src={"https://img.youtube.com/vi/" + previewVideo + "/hqdefault.jpg"} alt="Featured video thumbnail"/> : effectiveVideoUrl && <div className="mailing-generic-video">▶ <span>Featured video preview</span></div>)}</section></div></aside>
            </div>
          </section>
          <section className="mailing-history" id="mailing-schedules">
            <div className="mailing-section-heading"><div><span className="eyebrow">AUTOMATION & DELIVERY</span><h2>Scheduled emails</h2></div></div>
            {!currentSchedules.length ? <div className="mailing-empty">No scheduled emails for this list.</div> : currentSchedules.map((schedule) => <article className="mailing-history-row" key={schedule.id}><div><strong>{String(schedule.subject ?? "Email")}</strong><small>{String(schedule.repeat ?? "once")} · Next send {dateLabel(schedule.nextSendAt as DateLike)}{schedule.endsAt ? " · Ends " + dateLabel(schedule.endsAt as DateLike) : ""}</small>{typeof schedule.lastError === "string" && schedule.lastError && <small className="error-notice">{schedule.lastError}</small>}</div><span className={"mailing-status " + (schedule.active ? "active" : "completed")}>{String(schedule.status ?? (schedule.active ? "scheduled" : "completed"))}</span>{schedule.active === true && <><button className="outline-button" disabled={busy} onClick={() => editSchedule(schedule)}>Edit</button><button className="outline-button" disabled={busy} onClick={() => void updateRecord("schedules", schedule.id, "cancelled")}>Cancel</button></>}</article>)}
          </section>
          <section className="mailing-history" id="mailing-history">
            <div className="mailing-section-heading"><div><span className="eyebrow">RESEND DELIVERY RECORDS</span><h2>Email history</h2></div></div>
            {!currentHistory.length ? <div className="mailing-empty">Sent newsletters and meeting notifications will be listed here.</div> : currentHistory.map((item) => {
              const hasSavedCampaign = Boolean(item.campaign && typeof item.campaign === "object");
              const hasSentAt = Boolean(isoDateTime(item.sentAt));
              return <article className="mailing-history-row mailing-history-managed" key={item.id}><div><strong>{String(item.subject ?? "Email")}</strong><small>{dateLabel(item.sentAt as DateLike)} · {String(item.sent ?? 0)} delivered · {String(item.failed ?? 0)} failed · {String(item.requested ?? 0)} recipients</small></div><span className="mailing-status completed">{String(item.kind ?? "email")}</span><div className="mailing-history-actions">{hasSavedCampaign && <><button className="outline-button" disabled={busy} onClick={() => editHistory(item)}>Edit for new members</button><button className="outline-button" disabled={busy} onClick={() => void sendFromHistory(item, "all")}>Resend to all</button>{hasSentAt && <button className="outline-button" disabled={busy} onClick={() => void sendFromHistory(item, "new")}>Send to new</button>}</>}<button className="outline-button mailing-delete-history" disabled={busy} onClick={() => void deleteHistory(item)}>Delete record</button></div></article>;
            })}
          </section>
        </>}
      <style jsx global>{`
        .mailing-admin { --mailing-ink:#14233b; --mailing-muted:#66758b; --mailing-line:#e1e8f0; --mailing-blue:#245bd6; color:var(--mailing-ink); }
        .mailing-admin .admin-content { width:min(100% - 32px, 1500px); margin-inline:auto; }
        .mailing-admin .admin-heading { margin-bottom:24px; }
        .mailing-admin .mailing-quick-nav { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 20px; position:sticky; top:0; z-index:20; padding:10px 0; background:rgba(248,250,253,.94); backdrop-filter:blur(12px); }
        .mailing-admin .mailing-quick-nav button { border:1px solid var(--mailing-line); border-radius:999px; background:#fff; color:#33445c; padding:9px 14px; font:inherit; font-size:13px; font-weight:650; cursor:pointer; }
        .mailing-admin .mailing-quick-nav button:hover { border-color:#9ab7f5; color:var(--mailing-blue); }
        .mailing-admin .mailing-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
        .mailing-admin .mailing-stats article, .mailing-admin .mailing-people, .mailing-admin .mailing-compose, .mailing-admin .mailing-history { min-width:0; border:1px solid var(--mailing-line); border-radius:18px; background:#fff; box-shadow:0 8px 30px rgba(26,48,84,.045); }
        .mailing-admin .mailing-grid { display:grid; grid-template-columns:minmax(300px,.78fr) minmax(0,1.5fr); gap:20px; align-items:start; margin-top:20px; }
        .mailing-admin .mailing-people, .mailing-admin .mailing-compose, .mailing-admin .mailing-history { padding:clamp(14px,2vw,24px); }
        .mailing-admin .mailing-people { position:sticky; top:64px; max-height:calc(100vh - 84px); overflow:auto; }
        .mailing-admin .mailing-section-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .mailing-admin .mailing-section-heading h2 { margin:4px 0 0; }
        .mailing-admin .mailing-search-label { display:block; margin:16px 0 8px; font-size:13px; font-weight:650; }
        .mailing-admin .mailing-search-label input { display:block; width:100%; min-width:0; margin-top:7px; box-sizing:border-box; border:1px solid #d6dfeb; border-radius:10px; padding:11px 12px; background:#fbfcfe; color:inherit; font:inherit; }
        .mailing-admin .mailing-member-list { display:grid; gap:8px; max-height:52vh; overflow:auto; overscroll-behavior:contain; padding-right:3px; }
        .mailing-admin .mailing-member-list article { display:flex; align-items:center; gap:9px; min-width:0; flex-wrap:wrap; padding:12px; border:1px solid #edf1f6; border-radius:12px; background:#fff; }
        .mailing-admin .mailing-member-list article > div { flex:1 1 160px; min-width:0; }
        .mailing-admin .mailing-member-list article strong { display:block; overflow-wrap:anywhere; }
        .mailing-admin .mailing-member-list article small { display:block; color:var(--mailing-muted); line-height:1.5; overflow-wrap:anywhere; }
        .mailing-admin .mailing-form { display:grid; gap:17px; }
        .mailing-admin .mailing-form > label, .mailing-admin .mailing-rich-field { min-width:0; }
        .mailing-admin .mailing-form input, .mailing-admin .mailing-form select, .mailing-admin .mailing-schedule-form input, .mailing-admin .mailing-schedule-form select { max-width:100%; box-sizing:border-box; }
        .mailing-admin .mailing-form-actions { position:sticky; bottom:8px; z-index:10; display:flex; justify-content:flex-end; padding:10px; border:1px solid var(--mailing-line); border-radius:14px; background:rgba(255,255,255,.94); backdrop-filter:blur(10px); }
        .mailing-admin .mailing-history { margin-top:20px; scroll-margin-top:84px; }
        .mailing-admin #mailing-audience, .mailing-admin #mailing-compose { scroll-margin-top:84px; }
        .mailing-admin .mailing-history-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:12px; }
        .mailing-admin .mailing-history-row > div:first-child { min-width:0; }
        .mailing-admin .mailing-history-row strong, .mailing-admin .mailing-history-row small { overflow-wrap:anywhere; }
        .mailing-admin .mailing-history-actions { display:flex; flex-wrap:wrap; gap:8px; grid-column:1/-1; }
        .mailing-admin .mailing-template-preview { max-width:760px; margin-inline:auto; }
        .mailing-admin .mailing-template-card { overflow:hidden; }
        .mailing-admin .mailing-template-card img { max-width:100%; }
        .mailing-admin .mailing-grid-focused { display:block; max-width:1040px; margin-inline:auto; }
        .mailing-admin .mailing-grid-focused .mailing-people { display:none; }
        .mailing-admin .mailing-focus-mode .mailing-stats, .mailing-admin.mailing-focus-mode .mailing-quick-nav, .mailing-admin.mailing-focus-mode > .admin-content > .mailing-history { display:none; }
        .mailing-admin.mailing-focus-mode .mailing-grid { margin-top:8px; }
        .mailing-admin.mailing-focus-mode .mailing-compose { padding:clamp(16px,3vw,32px); box-shadow:0 18px 60px rgba(26,48,84,.09); }
        @media (max-width: 1000px) {
          .mailing-admin .mailing-grid { grid-template-columns:minmax(0,1fr); }
          .mailing-admin .mailing-people { position:static; max-height:none; }
          .mailing-admin .mailing-member-list { max-height:440px; }
        }
        @media (max-width: 640px) {
          .mailing-admin .admin-content { width:calc(100% - 20px); }
          .mailing-admin .mailing-stats { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
          .mailing-admin .mailing-stats article { padding:12px; }
          .mailing-admin .mailing-quick-nav { top:0; gap:6px; margin-inline:-2px; }
          .mailing-admin .mailing-quick-nav button { padding:8px 10px; font-size:12px; }
          .mailing-admin .mailing-section-heading { align-items:flex-start; flex-wrap:wrap; }
          .mailing-admin .mailing-focus-toggle { margin-left:auto; }
          .mailing-admin .mailing-history-row { grid-template-columns:minmax(0,1fr); }
          .mailing-admin .mailing-history-actions { grid-column:auto; }
          .mailing-admin .mailing-history-actions button { flex:1 1 140px; }
          .mailing-admin .mailing-form-actions { bottom:6px; }
          .mailing-admin .mailing-form-actions button { width:100%; }
        }
      `}</style>
    </div>
  </main>;
}
