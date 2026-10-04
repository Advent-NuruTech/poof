"use client";

import { collection, doc, limit, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import type { Playlist, Video } from "@/lib/catalog";

export default function ContentEditor() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [error, setError] = useState("");
  const [videoLimit, setVideoLimit] = useState(40);
  const [playlistLimit, setPlaylistLimit] = useState(40);

  useEffect(() => onSnapshot(query(collection(db, "videos"), orderBy("publishedAt", "desc"), limit(videoLimit)), (snapshot) => {
    setVideos(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as Video).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")));
  }, (reason) => setError(reason.message)), [videoLimit]);
  useEffect(() => onSnapshot(query(collection(db, "playlists"), orderBy("title", "asc"), limit(playlistLimit)), (snapshot) => {
    setPlaylists(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as Playlist));
  }, (reason) => setError(reason.message)), [playlistLimit]);

  async function updateVideo(video: Video, change: Partial<NonNullable<Video["website"]>>) {
    try { await setDoc(doc(db, "videos", video.id), { website: { ...video.website, ...change } }, { merge: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update this video."); }
  }
  async function updatePlaylist(playlist: Playlist, change: Partial<NonNullable<Playlist["website"]>>) {
    try { await setDoc(doc(db, "playlists", playlist.id), { website: { ...playlist.website, ...change } }, { merge: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update this playlist."); }
  }

  return <section className="admin-panel catalog-panel">
    <div className="section-heading"><div><span className="eyebrow">PRESENTATION</span><h2>Catalog controls</h2></div><span className="catalog-count">{videos.length} videos · {playlists.length} playlists</span></div>
    <p className="catalog-intro">Feature or hide synced content on the public homepage. YouTube metadata stays untouched.</p>
    {error && <p className="inline-error">{error}</p>}
    <div className="catalog-columns"><div><h3>Videos</h3>{videos.map((video) => <article className="catalog-row" key={video.id}><img src={video.thumbnail} alt=""/><div><strong>{video.website?.displayTitle || video.title}</strong><small>{video.channelTitle}</small></div><button aria-pressed={video.website?.featured === true} className={`mini-toggle ${video.website?.featured ? "toggle-on" : ""}`} onClick={() => void updateVideo(video, { featured: !video.website?.featured })}>{video.website?.featured ? "Featured" : "Feature"}</button><button aria-pressed={video.website?.hidden === true} className={`mini-toggle ${video.website?.hidden ? "toggle-on toggle-danger" : ""}`} onClick={() => void updateVideo(video, { hidden: !video.website?.hidden })}>{video.website?.hidden ? "Hidden" : "Hide"}</button></article>)}{videos.length >= videoLimit && <button className="load-more-button" onClick={() => setVideoLimit((count) => count + 40)}>Load 40 more videos</button>}</div><div><h3>Playlists</h3>{playlists.map((playlist) => <article className="catalog-row" key={playlist.id}><img src={playlist.thumbnail} alt=""/><div><strong>{playlist.title}</strong><small>{playlist.itemCount} videos · {playlist.channelTitle}</small></div><button aria-pressed={playlist.website?.featured === true} className={`mini-toggle ${playlist.website?.featured ? "toggle-on" : ""}`} onClick={() => void updatePlaylist(playlist, { featured: !playlist.website?.featured })}>{playlist.website?.featured ? "Featured" : "Feature"}</button><button aria-pressed={playlist.website?.hidden === true} className={`mini-toggle ${playlist.website?.hidden ? "toggle-on toggle-danger" : ""}`} onClick={() => void updatePlaylist(playlist, { hidden: !playlist.website?.hidden })}>{playlist.website?.hidden ? "Hidden" : "Hide"}</button></article>)}{playlists.length >= playlistLimit && <button className="load-more-button" onClick={() => setPlaylistLimit((count) => count + 40)}>Load 40 more playlists</button>}</div></div>
  </section>;
}
