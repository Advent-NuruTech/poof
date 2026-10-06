"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate, formatDuration, type Video } from "@/lib/catalog";
import { fetchCatalogFeed, feedChannels, feedPlaylists, feedVideos, usePublicCatalog } from "@/lib/use-catalog";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";
import { CardGridSkeleton, VideoListSkeleton } from "@/components/home/skeleton";

/** Playlists with more items than this link out instead of loading every video. */
const PLAYLIST_DETAIL_LIMIT = 60;

export default function PlaylistsPage({ playlistId }: { playlistId?: string }) {
  const [watching, setWatching] = useState<Video | null>(null);
  const [shareNotice, setShareNotice] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [revealed, setRevealed] = useState<{ playlistId?: string; ids: string[] }>({ ids: [] });

  // One cached read of the shared 24-hour snapshot replaces a live channels
  // listener, a live playlists listener, a per-playlist document read, and one
  // document read per playlist video. On a playlist of 200 videos the old code
  // billed 200 reads on every single visit; see lib/catalog-feed.ts.
  const { feed } = usePublicCatalog();
  const channels = feedChannels(feed);
  const playlists = feedPlaylists(feed);
  const loaded = feed.fetchedAt !== "";

  const activeChannelIds = new Set(channels.map((channel) => channel.id));
  const visiblePlaylists = playlists.filter((item) => activeChannelIds.has(item.channelId));
  const playlist = playlistId ? visiblePlaylists.find((item) => item.id === playlistId) ?? null : null;
  const detailLoaded = !playlistId || loaded;
  const videos = playlist ? feedVideos(feed).filter((video) => playlist.videoIds.includes(video.id)) : [];
  const videosById = new Map(videos.map((video) => [video.id, video]));
  const revealedIds = revealed.playlistId === playlistId ? revealed.ids : [];
  const playlistVideoIds = playlist ? (revealedIds.length ? revealedIds : playlist.videoIds.slice(0, PLAYLIST_DETAIL_LIMIT)) : [];
  const hiddenCount = playlist ? playlist.videoIds.length - playlistVideoIds.length : 0;

  async function loadRemainingVideos() {
    if (!playlist) return;
    setLoadingMore(true);
    // Reads the cached snapshot again, never Firestore directly.
    const next = await fetchCatalogFeed();
    if (next) {
      const ids = new Set(next.videos.map((video) => video.id));
      setRevealed({ playlistId, ids: playlist.videoIds.filter((id) => ids.has(id)) });
    }
    setLoadingMore(false);
  }

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
    <header className="playlist-page-header"><Link href="/">← Home</Link><span className="eyebrow">POF VIDEO LIBRARY</span><h1>{playlist ? playlist.title : "Playlists"}</h1><p>{playlist ? playlist.channelTitle : "Browse every playlist from our connected channels."}</p></header>
    {!loaded || !detailLoaded ? <section className="playlist-directory-loading"><CardGridSkeleton/></section> : playlistId && !playlist ? <section className="playlist-empty"><p>This playlist is not available.</p><Link href="/playlists">← All playlists</Link></section> : playlist ? <section className="playlist-detail">
      <div className="playlist-detail-heading"><img src={playlist.thumbnail} alt=""/><div><span className="eyebrow">PLAYLIST · {playlist.itemCount} VIDEOS</span><h2>{playlist.title}</h2><p>{playlist.channelTitle}</p></div></div>
      {playlist.description && <p className="playlist-description">{playlist.description}</p>}
      {!videos.length ? <VideoListSkeleton/> : <div className="latest-list playlist-featured-videos">{playlistVideoIds.map((id, index) => {
        const video = videosById.get(id);
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
      {hiddenCount > 0 && <button className="load-more-button" disabled={loadingMore} onClick={() => void loadRemainingVideos()}>{loadingMore ? "Loading…" : `Load ${hiddenCount} more videos`}</button>}
      {visiblePlaylists.filter((item) => item.id !== playlist.id).length > 0 && <section className="home-section may-like-section"><div className="home-section-title"><h2>You may also like</h2><Link href="/playlists">View all ›</Link></div><div className="playlist-strip">{visiblePlaylists.filter((item) => item.id !== playlist.id).slice(0, 8).map((item) => <Link className="playlist-card" href={`/playlists/${encodeURIComponent(item.id)}`} key={item.id}><span className="playlist-art"><img src={item.thumbnail} alt=""/><span>{item.itemCount} videos</span></span><strong>{item.title}</strong><small>{item.channelTitle}</small></Link>)}</div></section>}
      <Link className="playlist-back" href="/playlists">← All playlists</Link>
    </section> : <section className="playlist-directory">{visiblePlaylists.map((item) => <Link className="playlist-directory-card" href={`/playlists/${encodeURIComponent(item.id)}`} key={item.id}>
      <span className="playlist-art"><img src={item.thumbnail} alt=""/><span>{item.itemCount} videos</span></span><strong>{item.title}</strong><small>{item.channelTitle}</small>
    </Link>)}</section>}
    {watching && <div className="player-backdrop" role="dialog" aria-modal="true" aria-label={watching.title} onClick={() => setWatching(null)}><div className="player-modal" onClick={(event) => event.stopPropagation()}><button className="player-close" aria-label="Close player" onClick={() => setWatching(null)}>×</button><div className="player-frame">{watching.embeddable === false ? <div className="player-unavailable"><strong>This video can only be watched on YouTube.</strong><a href={`https://www.youtube.com/watch?v=${watching.id}`} target="_blank" rel="noreferrer">Open on YouTube</a></div> : <iframe src={`https://www.youtube-nocookie.com/embed/${watching.id}?autoplay=1&rel=0`} title={watching.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>}</div><div className="player-caption"><h2>{watching.website?.displayTitle || watching.title}</h2><p>{watching.description?.trim() || watching.channelTitle}</p></div></div></div>}
    {shareNotice && <div className="share-notice" role="status">{shareNotice}</div>}
    <MobileBottomNav current="library"/>
  </main>;
}
