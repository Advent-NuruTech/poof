"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { collection, deleteDoc, doc, documentId, getCountFromServer, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, Timestamp, where, writeBatch } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/sign-in";
import type { Channel, Playlist, Video } from "@/lib/catalog";
import { formatDate } from "@/lib/catalog";
import ContentEditor from "./content-editor";

type DraftChannel = Channel & { playlistCount?: number; videoCount?: number };
const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INITIAL_ADMIN_UID = "3H3BclyO2FePQ59KYIO2kKSirnx2";

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
  channelsRef.current = channels;
  busyRef.current = busy;

  useEffect(() => onAuthStateChanged(auth, (current) => { setUser(current); setAuthReady(true); }), []);
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    let active = true;
    const adminRef = doc(db, "admins", user.uid);
    getDoc(adminRef).then(async (snapshot) => {
      if (snapshot.exists()) {
        if (snapshot.data()?.enabled === true) {
          if (active) setIsAdmin(true);
          return;
        }
      }
      if (user.uid !== INITIAL_ADMIN_UID) {
        if (active) setIsAdmin(false);
        return;
      }
      await setDoc(adminRef, { enabled: true });
      if (active) setIsAdmin(true);
    }).catch((reason) => {
      if (!active) return;
      setIsAdmin(false);
      setError(reason instanceof Error ? reason.message : "Could not provision administrator access.");
    });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(collection(db, "channels"), (snapshot) => setChannels(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Channel)), (reason) => setError(reason.message));
  }, [isAdmin]);
  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([getCountFromServer(collection(db, "videos")), getCountFromServer(collection(db, "playlists"))])
      .then(([videoCount, playlistCount]) => setCatalogCounts({ videos: videoCount.data().count, playlists: playlistCount.data().count }))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load catalog totals."));
  }, [isAdmin, channels]);

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
      const videos = result.videos as Video[];
      const playlists = result.playlists as Playlist[];
      const unavailableVideoIds = result.unavailableVideoIds as string[];
      const [priorSnapshot, priorPlaylistSnapshot] = await Promise.all([
        getDocs(query(collection(db, "videos"), where("catalogChannelIds", "array-contains", channel.id))),
        getDocs(query(collection(db, "playlists"), where("channelId", "==", channel.id))),
      ]);
      const priorVideos = new Map(priorSnapshot.docs.map((entry) => [entry.id, entry.data()]));
      const idsToRead = [...new Set([...videos.map((video) => video.id), ...unavailableVideoIds])];
      const idChunks: string[][] = [];
      for (let offset = 0; offset < idsToRead.length; offset += 30) idChunks.push(idsToRead.slice(offset, offset + 30));
      for (let offset = 0; offset < idChunks.length; offset += 5) {
        const existingChunks = await Promise.all(idChunks.slice(offset, offset + 5).map((ids) => getDocs(query(collection(db, "videos"), where(documentId(), "in", ids)))));
        for (const chunk of existingChunks) for (const entry of chunk.docs) priorVideos.set(entry.id, entry.data());
      }
      const currentIds = new Set(videos.map((video) => video.id));
      const currentPlaylistIds = new Set(playlists.map((playlist) => playlist.id));
      const newVideoCount = videos.filter((video) => !priorVideos.has(video.id)).length;
      let batch = writeBatch(db);
      const operations: Array<() => void> = [];
      for (const playlist of playlists) operations.push(() => batch.set(doc(db, "playlists", playlist.id), { ...playlist, lastSyncedAt: serverTimestamp() }, { merge: true }));
      for (const entry of priorPlaylistSnapshot.docs) {
        if (!currentPlaylistIds.has(entry.id)) operations.push(() => batch.delete(doc(db, "playlists", entry.id)));
      }
      for (const video of videos) {
        const previous = priorVideos.get(video.id);
        const channelPlaylistIds = { ...(previous?.channelPlaylistIds ?? {}), [channel.id]: video.playlistIds ?? [] };
        const playlistIds = [...new Set(Object.values(channelPlaylistIds).flat())];
        const catalogChannelIds = [...new Set([...(previous?.catalogChannelIds ?? []), channel.id])];
        operations.push(() => batch.set(doc(db, "videos", video.id), { ...video, playlistIds, channelPlaylistIds, catalogChannelIds, availability: "available", lastSyncedAt: serverTimestamp() }, { merge: true }));
      }
      for (const entry of priorSnapshot.docs) {
        if (currentIds.has(entry.id) || unavailableVideoIds.includes(entry.id)) continue;
        const previous = entry.data();
        const catalogChannelIds = ((previous.catalogChannelIds as string[] | undefined) ?? []).filter((id) => id !== channel.id);
        const channelPlaylistIds = { ...(previous.channelPlaylistIds ?? {}) };
        delete channelPlaylistIds[channel.id];
        const playlistIds = [...new Set(Object.values(channelPlaylistIds).flat() as string[])];
        operations.push(() => batch.set(doc(db, "videos", entry.id), { catalogChannelIds, channelPlaylistIds, playlistIds, lastSyncedAt: serverTimestamp() }, { merge: true }));
      }
      for (const videoId of unavailableVideoIds) {
        if (priorVideos.has(videoId)) operations.push(() => batch.set(doc(db, "videos", videoId), { availability: "unavailable", lastSyncedAt: serverTimestamp() }, { merge: true }));
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
      setNotice(`${channel.title} synced · ${videos.length} videos · ${playlists.length} playlists`);
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
      <header className="admin-top"><a className="back-link" href="/">← <span>Home</span></a><div className="admin-mark">POF <span>STUDIO</span></div>{user ? <button className="text-button" onClick={() => signOut(auth)}>Sign out</button> : <span />}</header>
      <div className="admin-content">
        <div className="admin-heading"><span className="eyebrow">CONTENT CONTROL</span><h1>YouTube channels</h1><p>Connect your channels once. Videos and playlists stay in sync automatically.</p></div>
        {!user ? <section className="admin-panel sign-in-panel"><div className="panel-icon">◉</div><h2>Administrator sign in</h2><p>Sign in with your Google account to manage YouTube sources.</p>{error && <p className="inline-error">{error}</p>}<button className="primary-button" onClick={() => void signInWithGoogle().catch((reason) => setError(reason instanceof Error ? reason.message : "Google sign-in failed."))}>Continue with Google</button></section> : !isAdmin ? <section className="admin-panel sign-in-panel"><div className="panel-icon">⌑</div><h2>Admin access hasn’t been enabled</h2><p>Signed in as <strong>{user.displayName ?? user.email}</strong>.{user.uid === INITIAL_ADMIN_UID ? " Administrator access is being set up automatically." : " This Google account is not authorized to manage the site."}</p>{error && <p className="inline-error">{error}</p>}<button className="outline-button" onClick={() => signOut(auth)}>Sign out</button></section> : <>
          <section className="admin-panel add-panel"><div className="section-heading"><div><span className="eyebrow">SOURCES</span><h2>Add a YouTube channel</h2></div><span className="secure-label">● Private admin access</span></div><form className="channel-form" onSubmit={lookupChannel}><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Paste a channel URL, @handle, or channel ID" aria-label="YouTube channel URL, handle, or ID"/><button className="primary-button" disabled={busy === "lookup" || !queryText}>{busy === "lookup" ? "Checking…" : "Find channel"}</button></form>{preview && <div className="channel-preview"><img src={preview.thumbnail} alt=""/><div className="preview-copy"><strong>{preview.title}</strong><span>{preview.customUrl || preview.id}</span><small>{preview.playlistCount} playlists · {preview.videoCount} videos</small></div><button className="primary-button" onClick={addChannel}>Add & sync</button></div>}</section>
          <section className="catalog-summary" aria-label="Catalog totals"><div><span>CHANNELS</span><strong>{channels.length}</strong></div><div><span>PLAYLISTS</span><strong>{catalogCounts.playlists.toLocaleString()}</strong></div><div><span>VIDEOS</span><strong>{catalogCounts.videos.toLocaleString()}</strong></div><div><span>SYNC STATE</span><strong>{busy && busy !== "lookup" ? "Syncing" : error ? "Attention" : "Ready"}</strong></div></section>
          {(notice || error) && <div className={error ? "notice error-notice" : "notice"}>{error || notice}</div>}
          <div className="channel-list-heading"><h2>Your channels <span>{channels.length}</span></h2><span>Auto sync every 6 hours while this page is open</span></div>
          {channels.length === 0 ? <section className="admin-panel empty-state"><span className="empty-plus">＋</span><h3>No channels connected yet</h3><p>Add your first YouTube channel above to start building the video catalog.</p></section> : <div className="admin-channel-list">{channels.map((channel) => <article className="admin-channel" key={channel.id}><img className="channel-avatar" src={channel.thumbnail} alt=""/><div className="channel-details"><div className="channel-title-row"><h3>{channel.title}</h3><span className={`status-pill ${channel.syncStatus === "error" ? "status-error" : channel.enabled ? "" : "status-paused"}`}>{channel.syncStatus === "error" ? "Needs attention" : channel.enabled ? channel.syncStatus === "syncing" ? "Syncing" : "Connected" : "Paused"}</span></div><p>{channel.customUrl || channel.id}</p><small>{channel.lastSyncedAt ? `Last synced ${formatDate(((channel.lastSyncedAt as { toDate?: () => Date }).toDate?.() ?? new Date()).toISOString())}` : "Waiting for first sync"}{channel.lastSyncNewVideoCount ? ` · ${channel.lastSyncNewVideoCount} new videos` : ""}{channel.lastSyncError ? ` · ${channel.lastSyncError}` : ""}</small></div><div className="channel-actions"><button className="outline-button" disabled={Boolean(busy)} onClick={() => void syncChannel(channel)}>{busy === channel.id ? "Syncing…" : "Sync now"}</button><button className="icon-action" title={channel.enabled ? "Pause channel" : "Enable channel"} onClick={() => void toggleChannel(channel)}>{channel.enabled ? "Ⅱ" : "▶"}</button><button className="icon-action remove-action" title="Remove channel" onClick={() => void removeChannel(channel)}>×</button></div></article>)}</div>}
          <ContentEditor />
          <div className="admin-footnote">YouTube is the source of truth for video and playlist details. Website visibility and featured settings remain separate.</div>
        </>}
      </div>
    </main>
  );
}
