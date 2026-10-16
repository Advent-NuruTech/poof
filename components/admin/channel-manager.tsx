"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import Link from "next/link";
import { collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, Timestamp, where, writeBatch } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { auth, db } from "@/lib/firebase";
import { isAdminIdentity } from "@/lib/admin-access";
import { endAdminSession } from "@/lib/admin-session";
import type { Channel, Playlist } from "@/lib/catalog";
import { formatDate } from "@/lib/catalog";
import ContentEditor from "./content-editor";
import AdminInvites from "./admin-invites";
import NotificationBell from "./notification-bell";

type DraftChannel = Channel & { playlistCount?: number; videoCount?: number };
const AUTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Deep value comparison used to skip Firestore writes that would not change a
// document. A manifest field that changes on every sync is not a reason to
// rewrite the row, so it is excluded.
function isSameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => isSameValue(item, right[index]));
  if (left && right && typeof left === "object" && typeof right === "object") {
    const a = left as Record<string, unknown>;
    const b = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (key === "lastSyncedAt") continue;
      if (!isSameValue(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

/** True when writing `next` over `previous` would not change the stored document. */
function isUnchanged(previous: Record<string, unknown> | undefined, next: Record<string, unknown>): boolean {
  if (!previous) return false;
  return Object.entries(next).every(([key, value]) => key === "lastSyncedAt" || isSameValue(previous[key], value));
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [queryText, setQueryText] = useState("");
  const [preview, setPreview] = useState<DraftChannel | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [catalogCounts, setCatalogCounts] = useState({ videos: 0, playlists: 0 });
  const channelsRef = useRef(channels);
  const busyRef = useRef(busy);
  useEffect(() => { channelsRef.current = channels; }, [channels]);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => onAuthStateChanged(auth, (current) => { setUser(current); setAuthReady(true); if (!current) setIsAdmin(false); }), []);
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
    }).catch((reason) => {
      if (!active) return;
      setIsAdmin(false);
      setError(reason instanceof Error ? reason.message : "Could not provision administrator access.");
    });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (!isAdmin || !user) return;
    let active = true;
    void getDocs(collection(db, "channels")).then((snapshot) => {
      if (active) setChannels(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Channel));
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load channels."); });
    return () => { active = false; };
  }, [isAdmin, user]);
  useEffect(() => {
    if (!isAdmin || !user) return;
    Promise.all([user.getIdToken(), getCountFromServer(collection(db, "playlists"))])
      .then(async ([token, playlistCount]) => {
        const response = await fetch("/api/admin/videos?limit=1", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const result = await response.json() as { total?: number; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load video totals.");
        setCatalogCounts({ videos: result.total ?? 0, playlists: playlistCount.data().count });
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load catalog totals."));
  }, [isAdmin, user]);

  const syncChannel = useCallback(async (channel: Channel) => {
    if (!user) return;
    if (busyRef.current) { setNotice("Another channel is already syncing in this session."); return; }
    busyRef.current = channel.id;
    setBusy(channel.id);
    setError("");
    const lockRef = doc(db, "syncLeases", channel.id);
    let ownsLease = false;
    try {
      ownsLease = await runTransaction(db, async (transaction) => {
        const current = await transaction.get(lockRef);
        if (current.exists() && (current.data().expiresAt?.toMillis?.() ?? 0) > Date.now()) return false;
        transaction.set(lockRef, { owner: user.uid, expiresAt: Timestamp.fromMillis(Date.now() + 20 * 60 * 1000) });
        return true;
      });
      if (!ownsLease) { setNotice(`${channel.title} is already syncing in another session.`); return; }
      await setDoc(doc(db, "channels", channel.id), { syncStatus: "syncing" }, { merge: true });
      const token = await user.getIdToken();
      const response = await fetch(`/api/youtube?action=sync&channelId=${encodeURIComponent(channel.id)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not sync the channel.");
      const videoCount = Number(result.videoCount ?? 0);
      const newVideoCount = Number(result.newVideoCount ?? 0);
      const playlists = result.playlists as Playlist[];
      const priorPlaylistSnapshot = await getDocs(query(collection(db, "playlists"), where("channelId", "==", channel.id)));
      const currentPlaylistIds = new Set(playlists.map((playlist) => playlist.id));
      let batch = writeBatch(db);
      const operations: Array<() => void> = [];
      for (const playlist of playlists) {
        // Only write playlists whose stored data actually differs. A sync that
        // changes nothing must not rewrite the catalog: each rewrite burns a
        // write and re-delivers the document to every open listener.
        const next = { ...playlist, lastSyncedAt: serverTimestamp() };
        const previous = priorPlaylistSnapshot.docs.find((entry) => entry.id === playlist.id)?.data();
        if (!isUnchanged(previous, playlist as unknown as Record<string, unknown>)) operations.push(() => batch.set(doc(db, "playlists", playlist.id), next, { merge: true }));
      }
      for (const entry of priorPlaylistSnapshot.docs) {
        if (!currentPlaylistIds.has(entry.id)) operations.push(() => batch.delete(doc(db, "playlists", entry.id)));
      }
      let count = 0;
      for (const operation of operations) {
        operation();
        count += 1;
        if (count === 450) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count) await batch.commit();
      const syncedChannel = { ...result.channel };
      delete syncedChannel.enabled;
      await setDoc(doc(db, "channels", channel.id), { ...syncedChannel, syncStatus: "complete", lastSyncedAt: serverTimestamp(), lastSyncError: "", lastSyncNewVideoCount: newVideoCount }, { merge: true });
      await fetch("/api/admin/catalog/revalidate?scope=catalog", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setNotice(`${channel.title} synced · ${videoCount} videos · ${playlists.length} playlists`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Synchronization failed.";
      setError(message);
      await setDoc(doc(db, "channels", channel.id), { syncStatus: "error", lastSyncError: message }, { merge: true }).catch(() => undefined);
    } finally {
      if (ownsLease) await runTransaction(db, async (transaction) => {
        const current = await transaction.get(lockRef);
        if (current.data()?.owner === user.uid) transaction.delete(lockRef);
      }).catch(() => undefined);
      busyRef.current = "";
      setBusy("");
    }
  }, [user]);

  useEffect(() => {
    if (!isAdmin || !user) return;
    let mounted = true;
    const refreshDueChannels = async () => {
      if (!mounted) return;
      for (const channel of channelsRef.current) {
        if (!mounted || busyRef.current || !channel.enabled) continue;
        const snapshot = await getDoc(doc(db, "channels", channel.id)).catch(() => null);
        const data = snapshot?.data();
        const last = data?.lastSyncedAt?.toMillis?.() ?? 0;
        if (Date.now() - last >= AUTO_SYNC_INTERVAL_MS) await syncChannel(channel);
      }
    };
    void refreshDueChannels();
    const timer = window.setInterval(() => { void refreshDueChannels(); }, 15 * 60 * 1000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [isAdmin, user, channels, syncChannel]);

  async function lookupChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy("lookup"); setError(""); setPreview(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/youtube?action=lookup&query=${encodeURIComponent(queryText)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Channel lookup failed.");
      setPreview(result.channel);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Channel lookup failed."); }
    finally { setBusy(""); }
  }

  async function addChannel() {
    if (!preview) return;
    try {
      await setDoc(doc(db, "channels", preview.id), { ...preview, enabled: true, syncStatus: "queued", addedAt: serverTimestamp() }, { merge: true });
      setQueryText(""); setPreview(null);
      await syncChannel({ ...preview, enabled: true });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add this channel."); }
  }

  async function toggleChannel(channel: Channel) {
    try {
      await setDoc(doc(db, "channels", channel.id), { enabled: !channel.enabled }, { merge: true });
      setNotice(`${channel.title} ${channel.enabled ? "paused" : "enabled"}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the channel."); }
  }

  async function removeChannel(channel: Channel) {
    if (!window.confirm(`Remove ${channel.title} from the website? Its synchronized records will remain in Firestore.`)) return;
    try {
      await deleteDoc(doc(db, "channels", channel.id));
      setNotice(`${channel.title} was removed. Its YouTube videos remain in Firestore.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove the channel."); }
  }

  if (!authReady) return <main className="admin-shell"><div className="loading-card">Loading administrator access…</div></main>;
  return (
    <main className="admin-shell">
      <header className="admin-top"><Link className="back-link" href="/">← <span>Home</span></Link><div className="admin-mark">POF <span>STUDIO</span></div><div className="admin-top-actions">{user && <NotificationBell user={user}/>} {user ? <button className="text-button" onClick={() => void endAdminSession().then(() => signOut(auth)).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not sign out."))}>Sign out</button> : <span />}</div></header>
      <div className="admin-content">
        <div className="admin-heading"><span className="eyebrow">CONTENT CONTROL</span><h1>YouTube channels</h1><p>Connect your channels once. Videos and playlists stay in sync automatically.</p><Link className="outline-button meeting-admin-link" href="/poof/admin">← Back to dashboard</Link> <Link className="outline-button meeting-admin-link" href="/poof/admin/meetings">Manage Zoom meetings</Link> <Link className="outline-button meeting-admin-link" href="/poof/admin/library">Manage library</Link> <Link className="outline-button meeting-admin-link" href="/poof/admin/contacts">View contact & prayer inbox</Link> <Link className="outline-button meeting-admin-link" href="/poof/admin/link-requests">View Zoom link requests</Link> <Link className="outline-button meeting-admin-link" href="/meeting-link-request" target="_blank">Preview link request form</Link></div>
        {!user ? <section className="admin-panel sign-in-panel"><div className="panel-icon">◉</div><h2>Administrator sign in</h2><p>Sign in with your administrator email and password to manage YouTube sources.</p>{error && <p className="inline-error">{error}</p>}<Link className="primary-button" href="/signin">Sign in</Link></section> : !isAdmin ? <section className="admin-panel sign-in-panel"><div className="panel-icon">⌑</div><h2>Admin access required</h2><p>Sign in again with an authorized administrator account.</p>{error && <p className="inline-error">{error}</p>}<Link className="outline-button" href="/signin">Sign in</Link></section> : <>
          <section className="admin-panel add-panel"><div className="section-heading"><div><span className="eyebrow">SOURCES</span><h2>Add a YouTube channel</h2></div><span className="secure-label">● Private admin access</span></div><form className="channel-form" onSubmit={lookupChannel}><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Paste a channel URL, @handle, or channel ID" aria-label="YouTube channel URL, handle, or ID"/><button className="primary-button" disabled={busy === "lookup" || !queryText}>{busy === "lookup" ? "Checking…" : "Find channel"}</button></form>{preview && <div className="channel-preview"><img src={preview.thumbnail} alt=""/><div className="preview-copy"><strong>{preview.title}</strong><span>{preview.customUrl || preview.id}</span><small>{preview.playlistCount} playlists · {preview.videoCount} videos</small></div><button className="primary-button" onClick={addChannel}>Add & sync</button></div>}</section>
          <section className="catalog-summary" aria-label="Catalog totals"><div><span>CHANNELS</span><strong>{channels.length}</strong></div><div><span>PLAYLISTS</span><strong>{catalogCounts.playlists.toLocaleString()}</strong></div><div><span>VIDEOS</span><strong>{catalogCounts.videos.toLocaleString()}</strong></div><div><span>SYNC STATE</span><strong>{busy && busy !== "lookup" ? "Syncing" : error ? "Attention" : "Ready"}</strong></div></section>
          {(notice || error) && <div className={error ? "notice error-notice" : "notice"}>{error || notice}</div>}
          <div className="channel-list-heading"><h2>Your channels <span>{channels.length}</span></h2><span>Auto sync once every 24 hours while this page is open</span></div>
          {channels.length === 0 ? <section className="admin-panel empty-state"><span className="empty-plus">＋</span><h3>No channels connected yet</h3><p>Add your first YouTube channel above to start building the video catalog.</p></section> : <div className="admin-channel-list">{channels.map((channel) => <article className="admin-channel" key={channel.id}><img className="channel-avatar" src={channel.thumbnail} alt=""/><div className="channel-details"><div className="channel-title-row"><h3>{channel.title}</h3><span className={`status-pill ${channel.syncStatus === "error" ? "status-error" : channel.enabled ? "" : "status-paused"}`}>{channel.syncStatus === "error" ? "Needs attention" : channel.enabled ? channel.syncStatus === "syncing" ? "Syncing" : "Connected" : "Paused"}</span></div><p>{channel.customUrl || channel.id}</p><small>{channel.lastSyncedAt ? `Last synced ${formatDate(((channel.lastSyncedAt as { toDate?: () => Date }).toDate?.() ?? new Date()).toISOString())}` : "Waiting for first sync"}{channel.lastSyncNewVideoCount ? ` · ${channel.lastSyncNewVideoCount} new videos` : ""}{channel.lastSyncError ? ` · ${channel.lastSyncError}` : ""}</small></div><div className="channel-actions"><button className="outline-button" disabled={Boolean(busy)} onClick={() => void syncChannel(channel)}>{busy === channel.id ? "Syncing…" : "Sync now"}</button><button className="icon-action" title={channel.enabled ? "Pause channel" : "Enable channel"} onClick={() => void toggleChannel(channel)}>{channel.enabled ? "Ⅱ" : "▶"}</button><button className="icon-action remove-action" title="Remove channel" onClick={() => void removeChannel(channel)}>×</button></div></article>)}</div>}
          <ContentEditor />
          <AdminInvites />
          <div className="admin-footnote">YouTube is the source of truth for video and playlist details. Website visibility and featured settings remain separate.</div>
        </>}
      </div>
    </main>
  );
}
