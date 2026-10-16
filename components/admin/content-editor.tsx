"use client";

import { collection, doc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import type { Playlist, Video } from "@/lib/catalog";

export default function ContentEditor() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [error, setError] = useState("");
  const [videoLimit, setVideoLimit] = useState(40);
  const [playlistLimit, setPlaylistLimit] = useState(40);
  const [videoTotal, setVideoTotal] = useState(0);

  useEffect(() => { let active = true; void (async () => { try { const token = await auth.currentUser?.getIdToken(); if (!token) throw new Error("Sign in again to manage videos."); const response = await fetch(`/api/admin/videos?limit=${videoLimit}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }); const result = await response.json() as { videos?: Video[]; total?: number; error?: string }; if (!response.ok) throw new Error(result.error ?? "Could not load videos."); if (active) { setVideos(result.videos ?? []); setVideoTotal(result.total ?? 0); } } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Could not load videos."); } })(); return () => { active = false; }; }, [videoLimit]);
  useEffect(() => { let active = true; void getDocs(query(collection(db, "playlists"), orderBy("title", "asc"), limit(playlistLimit))).then((snapshot) => { if (active) setPlaylists(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as Playlist)); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load playlists."); }); return () => { active = false; }; }, [playlistLimit]);

  async function updateVideo(video: Video, change: Partial<NonNullable<Video["website"]>>) {
    try { const token = await auth.currentUser?.getIdToken(); if (!token) throw new Error("Sign in again to update videos."); const website = { ...video.website, ...change }; const response = await fetch("/api/admin/videos", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: video.id, website }) }); const result = await response.json() as { video?: Video; error?: string }; if (!response.ok || !result.video) throw new Error(result.error ?? "Could not update this video."); setVideos((items) => items.map((item) => item.id === video.id ? result.video! : item)); await fetch("/api/admin/catalog/revalidate", { method: "POST", headers: { Authorization: `Bearer ${token}` } }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update this video."); }
  }
  async function updatePlaylist(playlist: Playlist, change: Partial<NonNullable<Playlist["website"]>>) {
    try { const website = { ...playlist.website, ...change }; await setDoc(doc(db, "playlists", playlist.id), { website }, { merge: true }); setPlaylists((items) => items.map((item) => item.id === playlist.id ? { ...item, website } : item)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update this playlist."); }
  }

  return <section className="admin-panel catalog-panel">
    <div className="section-heading"><div><span className="eyebrow">PRESENTATION</span><h2>Catalog controls</h2></div><span className="catalog-count">{videos.length} videos · {playlists.length} playlists</span></div>
    <p className="catalog-intro">Feature or hide synced content on the public homepage. YouTube metadata stays untouched.</p>
    {error && <p className="inline-error">{error}</p>}
    <div className="catalog-columns"><div><h3>Videos</h3>{videos.map((video) => <article className="catalog-row" key={video.id}><img src={video.thumbnail} alt=""/><div><strong>{video.website?.displayTitle || video.title}</strong><small>{video.channelTitle}</small></div><button aria-pressed={video.website?.featured === true} className={`mini-toggle ${video.website?.featured ? "toggle-on" : ""}`} onClick={() => void updateVideo(video, { featured: !video.website?.featured })}>{video.website?.featured ? "Featured" : "Feature"}</button><button aria-pressed={video.website?.hidden === true} className={`mini-toggle ${video.website?.hidden ? "toggle-on toggle-danger" : ""}`} onClick={() => void updateVideo(video, { hidden: !video.website?.hidden })}>{video.website?.hidden ? "Hidden" : "Hide"}</button></article>)}{videos.length < videoTotal && <button className="load-more-button" onClick={() => setVideoLimit((count) => count + 40)}>Load 40 more videos</button>}</div><div><h3>Playlists</h3>{playlists.map((playlist) => <article className="catalog-row" key={playlist.id}><img src={playlist.thumbnail} alt=""/><div><strong>{playlist.title}</strong><small>{playlist.itemCount} videos · {playlist.channelTitle}</small></div><button aria-pressed={playlist.website?.featured === true} className={`mini-toggle ${playlist.website?.featured ? "toggle-on" : ""}`} onClick={() => void updatePlaylist(playlist, { featured: !playlist.website?.featured })}>{playlist.website?.featured ? "Featured" : "Feature"}</button><button aria-pressed={playlist.website?.hidden === true} className={`mini-toggle ${playlist.website?.hidden ? "toggle-on toggle-danger" : ""}`} onClick={() => void updatePlaylist(playlist, { hidden: !playlist.website?.hidden })}>{playlist.website?.hidden ? "Hidden" : "Hide"}</button></article>)}{playlists.length >= playlistLimit && <button className="load-more-button" onClick={() => setPlaylistLimit((count) => count + 40)}>Load 40 more playlists</button>}</div></div>
  </section>;
}
