"use client";

import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { formatDuration, type Channel, type Playlist, type Video } from "@/lib/catalog";

export default function PlaylistsPage({ playlistId }: { playlistId?: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [videos, setVideos] = useState<Record<string, Video>>({});

  useEffect(() => onSnapshot(collection(db, "channels"), (snapshot) => {
    setChannels(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as Channel).filter((channel) => channel.enabled));
  }, () => setChannels([])), []);
  useEffect(() => onSnapshot(collection(db, "playlists"), (snapshot) => {
    setPlaylists(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as Playlist).filter((item) => !item.website?.hidden));
  }, () => setPlaylists([])), []);

  const activeChannelIds = new Set(channels.map((channel) => channel.id));
  const visiblePlaylists = playlists.filter((item) => activeChannelIds.has(item.channelId));
  useEffect(() => {
    if (!playlistId) { setPlaylist(null); return; }
    let active = true;
    setPlaylist(null);
    getDoc(doc(db, "playlists", playlistId)).then((snapshot) => {
      if (!active || !snapshot.exists()) return;
      const item = { ...snapshot.data(), id: snapshot.id } as Playlist;
      if (!item.website?.hidden && activeChannelIds.has(item.channelId)) setPlaylist(item);
    }).catch(() => setPlaylist(null));
    return () => { active = false; };
  }, [playlistId, playlists, channels]);
  useEffect(() => {
    if (!playlist) { setVideos({}); return; }
    let active = true;
    Promise.all(playlist.videoIds.map(async (id) => {
      try {
        const snapshot = await getDoc(doc(db, "videos", id));
        return snapshot.exists() ? [id, { ...snapshot.data(), id: snapshot.id } as Video] as const : null;
      } catch { return null; }
    })).then((rows) => { if (active) setVideos(Object.fromEntries(rows.filter((row): row is NonNullable<typeof row> => row !== null))); });
    return () => { active = false; };
  }, [playlist]);

  return <main className="playlist-page">
    <header className="playlist-page-header"><a href="/">← Home</a><span className="eyebrow">POF VIDEO LIBRARY</span><h1>{playlist ? playlist.title : "Playlists"}</h1><p>{playlist ? playlist.channelTitle : "Browse every playlist from our connected channels."}</p></header>
    {playlist ? <section className="playlist-detail">
      <div className="playlist-detail-heading"><img src={playlist.thumbnail} alt=""/><div><span className="eyebrow">PLAYLIST · {playlist.itemCount} VIDEOS</span><h2>{playlist.title}</h2><p>{playlist.channelTitle}</p></div></div>
      {playlist.description && <p className="playlist-description">{playlist.description}</p>}
      <div className="playlist-video-list">{playlist.videoIds.map((id, index) => {
        const video = videos[id];
        return <a key={`${id}-${index}`} href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer" className="playlist-detail-video">
          <span className="playlist-order">{String(index + 1).padStart(2, "0")}</span>
          {video && <img src={video.thumbnail} alt=""/>}
          <span className="playlist-video-copy"><strong>{video?.website?.displayTitle || video?.title || "Watch this video on YouTube"}</strong><small>{video ? `${formatDuration(video.duration)} · ${video.channelTitle}` : "Open on YouTube"}</small></span><span aria-hidden="true">›</span>
        </a>;
      })}</div>
      <a className="playlist-back" href="/playlists">← All playlists</a>
    </section> : <section className="playlist-directory">{visiblePlaylists.map((item) => <a className="playlist-directory-card" href={`/playlists/${encodeURIComponent(item.id)}`} key={item.id}>
      <span className="playlist-art"><img src={item.thumbnail} alt=""/><span>{item.itemCount} videos</span></span><strong>{item.title}</strong><small>{item.channelTitle}</small>
    </a>)}</section>}
  </main>;
}
