"use client";

import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { formatDate, formatDuration, type Channel, type Playlist, type Video } from "@/lib/catalog";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";
import { CardGridSkeleton, VideoListSkeleton } from "@/components/home/skeleton";

export default function PlaylistsPage({ playlistId }: { playlistId?: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [videos, setVideos] = useState<Record<string, Video>>({});
  const [watching, setWatching] = useState<Video | null>(null);
  const [shareNotice, setShareNotice] = useState("");
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const [detailLoaded, setDetailLoaded] = useState(!playlistId);
  const [videosLoaded, setVideosLoaded] = useState(false);

  useEffect(() => onSnapshot(collection(db, "channels"), (snapshot) => {
    setChannels(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as Channel).filter((channel) => channel.enabled));
    setChannelsLoaded(true);
  }, () => { setChannels([]); setChannelsLoaded(true); }), []);
  useEffect(() => onSnapshot(collection(db, "playlists"), (snapshot) => {
    setPlaylists(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as Playlist).filter((item) => !item.website?.hidden));
    setPlaylistsLoaded(true);
  }, () => { setPlaylists([]); setPlaylistsLoaded(true); }), []);

  const activeChannelIds = new Set(channels.map((channel) => channel.id));
  const visiblePlaylists = playlists.filter((item) => activeChannelIds.has(item.channelId));
  useEffect(() => {
    if (!playlistId) { setPlaylist(null); setDetailLoaded(true); return; }
    let active = true;
    setDetailLoaded(false);
    setPlaylist(null);
    getDoc(doc(db, "playlists", playlistId)).then((snapshot) => {
      if (!active) return;
      setDetailLoaded(true);
      if (!snapshot.exists()) return;
      const item = { ...snapshot.data(), id: snapshot.id } as Playlist;
      if (!item.website?.hidden && activeChannelIds.has(item.channelId)) setPlaylist(item);
    }).catch(() => { if (active) setDetailLoaded(true); setPlaylist(null); });
    return () => { active = false; };
  }, [playlistId, playlists, channels]);
  useEffect(() => {
    if (!playlist) { setVideos({}); setVideosLoaded(false); return; }
    let active = true;
    setVideosLoaded(false);
    Promise.all(playlist.videoIds.map(async (id) => {
      try {
        const snapshot = await getDoc(doc(db, "videos", id));
        return snapshot.exists() ? [id, { ...snapshot.data(), id: snapshot.id } as Video] as const : null;
      } catch { return null; }
    })).then((rows) => { if (active) { setVideos(Object.fromEntries(rows.filter((row): row is NonNullable<typeof row> => row !== null))); setVideosLoaded(true); } });
    return () => { active = false; };
  }, [playlist]);

  async function shareVideo(video: Video) {
    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
    try {
      if (navigator.share) await navigator.share({ url });
      else { await navigator.clipboard.writeText(url); setShareNotice("Video link copied"); }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      try { await navigator.clipboard.writeText(url); setShareNotice("Video link copied"); }
      catch { setShareNotice("Could not share this video"); }
    }
    window.setTimeout(() => setShareNotice(""), 2200);
  }

  return <main className="playlist-page">
    <header className="playlist-page-header"><a href="/">← Home</a><span className="eyebrow">POF VIDEO LIBRARY</span><h1>{playlist ? playlist.title : "Playlists"}</h1><p>{playlist ? playlist.channelTitle : "Browse every playlist from our connected channels."}</p></header>
    {!channelsLoaded || !playlistsLoaded || !detailLoaded ? <section className="playlist-directory-loading"><CardGridSkeleton/></section> : playlist ? <section className="playlist-detail">
      <div className="playlist-detail-heading"><img src={playlist.thumbnail} alt=""/><div><span className="eyebrow">PLAYLIST · {playlist.itemCount} VIDEOS</span><h2>{playlist.title}</h2><p>{playlist.channelTitle}</p></div></div>
      {playlist.description && <p className="playlist-description">{playlist.description}</p>}
      {!videosLoaded ? <VideoListSkeleton/> : <div className="latest-list playlist-featured-videos">{playlist.videoIds.map((id, index) => {
        const video = videos[id];
        return <article className="latest-card" key={`${id}-${index}`}>
          <button className="video-thumb" onClick={() => video ? setWatching(video) : window.open(`https://www.youtube.com/watch?v=${id}`, "_blank", "noopener,noreferrer")} aria-label={`Watch ${video?.title ?? "video"}`}>
            {video && <img src={video.thumbnail} alt=""/>}<span className="duration-tag">{formatDuration(video?.duration)}</span><span className="thumb-play">▶</span>
          </button>
          <button className="video-copy" onClick={() => video ? setWatching(video) : window.open(`https://www.youtube.com/watch?v=${id}`, "_blank", "noopener,noreferrer")}>
            <strong>{video?.website?.displayTitle || video?.title || "Watch this video on YouTube"}</strong><time>{video ? formatDate(video.publishedAt) : ""}</time><span className="video-description">{video?.description?.trim() || video?.channelTitle || "Open on YouTube"}</span>
          </button>
          {video && <button className="more-button" aria-label={`Share ${video.title}`} title="Share video" onClick={() => void shareVideo(video)}>•••</button>}
        </article>;
      })}</div>}
      {visiblePlaylists.filter((item) => item.id !== playlist.id).length > 0 && <section className="home-section may-like-section"><div className="home-section-title"><h2>You may also like</h2><a href="/playlists">View all ›</a></div><div className="playlist-strip">{visiblePlaylists.filter((item) => item.id !== playlist.id).slice(0, 8).map((item) => <a className="playlist-card" href={`/playlists/${encodeURIComponent(item.id)}`} key={item.id}><span className="playlist-art"><img src={item.thumbnail} alt=""/><span>{item.itemCount} videos</span></span><strong>{item.title}</strong><small>{item.channelTitle}</small></a>)}</div></section>}
      <a className="playlist-back" href="/playlists">← All playlists</a>
    </section> : <section className="playlist-directory">{visiblePlaylists.map((item) => <a className="playlist-directory-card" href={`/playlists/${encodeURIComponent(item.id)}`} key={item.id}>
      <span className="playlist-art"><img src={item.thumbnail} alt=""/><span>{item.itemCount} videos</span></span><strong>{item.title}</strong><small>{item.channelTitle}</small>
    </a>)}</section>}
    {watching && <div className="player-backdrop" role="dialog" aria-modal="true" aria-label={watching.title} onClick={() => setWatching(null)}><div className="player-modal" onClick={(event) => event.stopPropagation()}><button className="player-close" aria-label="Close player" onClick={() => setWatching(null)}>×</button><div className="player-frame">{watching.embeddable === false ? <div className="player-unavailable"><strong>This video can only be watched on YouTube.</strong><a href={`https://www.youtube.com/watch?v=${watching.id}`} target="_blank" rel="noreferrer">Open on YouTube</a></div> : <iframe src={`https://www.youtube-nocookie.com/embed/${watching.id}?autoplay=1&rel=0`} title={watching.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>}</div><div className="player-caption"><h2>{watching.website?.displayTitle || watching.title}</h2><p>{watching.description?.trim() || watching.channelTitle}</p></div></div></div>}
    {shareNotice && <div className="share-notice" role="status">{shareNotice}</div>}
    <MobileBottomNav current="playlists"/>
  </main>;
}
