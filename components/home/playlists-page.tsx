"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate, formatDuration, type Video } from "@/lib/catalog";
import { fetchCatalogFeed, feedChannels, feedPlaylists, feedVideos, usePublicCatalog } from "@/lib/use-catalog";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";
import { CardGridSkeleton, VideoListSkeleton } from "@/components/home/skeleton";

/** Playlists with more items than this link out instead of loading every video. */
const PLAYLIST_DETAIL_LIMIT = 60;

const CSS = `
.pl-page{
  --ink:#0a0a0a;--paper:#fff;--paper-2:#f6f6f4;--paper-3:#efefec;
  --line:rgba(10,10,10,.12);--line-strong:rgba(10,10,10,.28);
  --muted:#6b6b68;--muted-2:#9a9a96;--red:#d0021b;
  background:var(--paper);color:var(--ink);min-height:100vh;
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
.pl-page *{box-sizing:border-box}
.pl-display{
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  font-weight:500;letter-spacing:-.045em;line-height:.98;color:var(--ink);
}

/* ================= HERO ================= */
.pl-hero{
  position:relative;padding:56px 24px 44px;text-align:center;overflow:hidden;
  background:
    radial-gradient(900px 340px at 50% -20%,rgba(208,2,27,.055),transparent 60%),
    radial-gradient(1200px 500px at 50% 0%,rgba(10,10,10,.045),transparent 65%),
    linear-gradient(180deg,#fbfbf9 0%,#fff 100%);
  border-bottom:1px solid var(--line);
}
.pl-hero::before{
  content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;
  background-image:
    linear-gradient(to right,rgba(10,10,10,.045) 1px,transparent 1px),
    linear-gradient(to bottom,rgba(10,10,10,.045) 1px,transparent 1px);
  background-size:56px 56px;
  mask-image:radial-gradient(circle at 50% 30%,#000 0%,transparent 70%);
  -webkit-mask-image:radial-gradient(circle at 50% 30%,#000 0%,transparent 70%);
}
.pl-hero::after{
  content:"";position:absolute;left:50%;bottom:0;transform:translateX(-50%);
  width:min(560px,70%);height:1px;
  background:linear-gradient(90deg,transparent,var(--red),transparent);opacity:.55;
}
.pl-hero-inner{position:relative;max-width:1120px;margin:0 auto;z-index:1}

.pl-crumbs{
  display:inline-flex;align-items:center;gap:8px;
  font-size:11px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--muted);margin-bottom:22px;
}
.pl-crumbs a{color:var(--ink);text-decoration:none;border-bottom:1px solid transparent;transition:border-color .2s}
.pl-crumbs a:hover{border-color:var(--red)}

.pl-eyebrow{
  display:inline-flex;align-items:center;gap:10px;
  font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0;
}
.pl-eyebrow-line{display:inline-block;width:26px;height:1px;background:var(--red)}

.pl-title{font-size:clamp(40px,6.5vw,84px);margin:14px 0 14px}
.pl-title em{font-style:normal;color:var(--red);font-weight:500}

.pl-lede{
  font-size:clamp(15px,1.3vw,17px);line-height:1.6;color:var(--muted);
  max-width:56ch;margin:0 auto;
}

/* ================= SECTIONS ================= */
.pl-section{max-width:1120px;margin:0 auto;padding:48px 24px 72px}
.pl-section-head{
  display:flex;align-items:flex-end;justify-content:space-between;gap:24px;
  margin-bottom:28px;flex-wrap:wrap;
}
.pl-h2{
  font-family:"Helvetica Neue",Helvetica,Inter,sans-serif;
  font-weight:500;font-size:clamp(24px,2.6vw,34px);letter-spacing:-.03em;line-height:1.05;margin:0;
}
.pl-back{
  display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:var(--ink);
  font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  padding-bottom:4px;border-bottom:1px solid var(--line-strong);
  transition:color .2s,border-color .2s;
}
.pl-back:hover{color:var(--red);border-color:var(--red)}
.pl-back svg{transition:transform .2s}
.pl-back:hover svg{transform:translateX(-3px)}

/* ================= PLAYLIST DIRECTORY GRID ================= */
.pl-grid{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:22px;
}
.pl-card{
  display:flex;flex-direction:column;gap:12px;text-decoration:none;color:inherit;
  background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px;
  transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s,border-color .25s;
}
.pl-card:hover{transform:translateY(-3px);border-color:var(--line-strong);box-shadow:0 10px 30px -12px rgba(10,10,10,.18)}
.pl-art{
  position:relative;display:block;aspect-ratio:16/10;border-radius:10px;overflow:hidden;
  background:var(--paper-2);
}
.pl-art img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s}
.pl-card:hover .pl-art img{transform:scale(1.05)}
.pl-art span{
  position:absolute;bottom:10px;left:10px;
  background:rgba(10,10,10,.85);color:#fff;
  font-size:10.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  padding:4px 9px;border-radius:999px;
}
.pl-card strong{font-size:14.5px;font-weight:600;letter-spacing:-.01em;line-height:1.3;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
}
.pl-card small{font-size:12px;color:var(--muted)}

/* ================= PLAYLIST DETAIL ================= */
.pl-detail{max-width:1120px;margin:0 auto;padding:48px 24px 72px}

.pl-detail-head{
  display:flex;align-items:flex-start;gap:28px;margin-bottom:32px;flex-wrap:wrap;
  padding-bottom:28px;border-bottom:1px solid var(--line);
}
.pl-detail-art{
  width:min(320px,42%);
  aspect-ratio:16/10;border-radius:16px;overflow:hidden;
  border:1px solid var(--line);background:var(--paper-2);flex:0 0 auto;
  box-shadow:0 20px 40px -30px rgba(10,10,10,.35);
}
.pl-detail-art img{width:100%;height:100%;object-fit:cover;display:block}
.pl-detail-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:12px}
.pl-detail-copy h1{
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  font-weight:500;font-size:clamp(28px,3.6vw,44px);letter-spacing:-.035em;line-height:1.05;
  margin:6px 0 0;
}
.pl-detail-copy p{margin:0;color:var(--muted);font-size:14.5px;line-height:1.55}
.pl-detail-desc{
  margin-top:6px;font-size:14px;line-height:1.7;color:var(--muted);
  max-width:70ch;
}

/* Video list — reuses latest-card grid look, adds red hairline accent */
.pl-video-list{display:flex;flex-direction:column;gap:14px}
.pl-video-list .latest-card{
  display:grid;grid-template-columns:minmax(0,240px) minmax(0,1fr) auto;
  gap:22px;align-items:center;
  padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--paper);
  transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s,border-color .25s;
}
.pl-video-list .latest-card:hover{
  transform:translateY(-2px);border-color:var(--line-strong);
  box-shadow:0 10px 30px -12px rgba(10,10,10,.18);
}
.pl-video-list .video-thumb{
  position:relative;padding:0;border:0;background:var(--paper-2);cursor:pointer;
  border-radius:12px;overflow:hidden;aspect-ratio:16/9;
}
.pl-video-list .video-thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s}
.pl-video-list .latest-card:hover .video-thumb img{transform:scale(1.04)}
.pl-video-list .duration-tag{
  position:absolute;bottom:10px;right:10px;
  background:rgba(10,10,10,.85);color:#fff;
  font-size:11px;font-weight:600;letter-spacing:.06em;
  padding:4px 8px;border-radius:4px;
}
.pl-video-list .thumb-play{
  position:absolute;inset:0;display:grid;place-items:center;
  background:linear-gradient(180deg,rgba(10,10,10,0) 50%,rgba(10,10,10,.35));
  color:#fff;font-size:22px;opacity:0;transition:opacity .25s;
}
.pl-video-list .latest-card:hover .thumb-play{opacity:1}
.pl-video-list .video-copy{
  text-align:left;border:0;background:transparent;padding:0;cursor:pointer;
  display:flex;flex-direction:column;gap:6px;min-width:0;
}
.pl-video-list .video-copy strong{
  font-size:16.5px;font-weight:600;letter-spacing:-.015em;line-height:1.3;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
}
.pl-video-list .video-copy time{
  font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600;
}
.pl-video-list .video-description{
  font-size:13px;line-height:1.5;color:var(--muted);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
}
.pl-video-list .more-button{
  border:1px solid var(--line-strong);background:transparent;color:var(--ink);
  width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-size:14px;
  transition:background .2s,color .2s,border-color .2s;
}
.pl-video-list .more-button:hover{background:var(--ink);color:var(--paper);border-color:var(--ink)}

/* Load more */
.pl-load-more{
  display:block;margin:28px auto 0;
  padding:14px 26px;border-radius:999px;cursor:pointer;
  border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);
  font:inherit;font-size:12.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  transition:background .2s,color .2s,border-color .2s,transform .15s;
}
.pl-load-more:hover:not(:disabled){background:var(--ink);color:var(--paper);border-color:var(--ink);transform:translateY(-1px)}
.pl-load-more:disabled{opacity:.6;cursor:progress}

/* "You may also like" */
.pl-related{border-top:1px solid var(--line);margin-top:56px;padding-top:48px}
.pl-related-title{
  display:flex;align-items:flex-end;justify-content:space-between;gap:24px;
  margin-bottom:24px;flex-wrap:wrap;
}
.pl-related-link{
  display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:var(--ink);
  font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  padding-bottom:4px;border-bottom:1px solid var(--line-strong);
  transition:color .2s,border-color .2s;
}
.pl-related-link:hover{color:var(--red);border-color:var(--red)}

.pl-detail-back{
  display:inline-flex;align-items:center;gap:8px;margin-top:56px;
  text-decoration:none;color:var(--ink);
  font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  padding-bottom:4px;border-bottom:1px solid var(--line-strong);
  transition:color .2s,border-color .2s;
}
.pl-detail-back:hover{color:var(--red);border-color:var(--red)}

/* ================= EMPTY ================= */
.pl-empty{
  max-width:720px;margin:80px auto;padding:64px 24px;text-align:center;
  border:1px dashed var(--line-strong);border-radius:20px;
  background:linear-gradient(180deg,#fbfbf9,#fff);
}
.pl-empty p{color:var(--muted);font-size:14.5px;margin:0 0 20px}
.pl-empty a{
  display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:var(--ink);
  font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  padding:12px 20px;border:1px solid var(--line-strong);border-radius:999px;
  transition:background .2s,color .2s,border-color .2s;
}
.pl-empty a:hover{background:var(--ink);color:var(--paper);border-color:var(--ink)}

/* ================= MODAL ================= */
.pl-page .player-backdrop{
  position:fixed;inset:0;z-index:80;
  background:rgba(10,10,10,.82);
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  display:grid;place-items:center;padding:32px 20px;
}
.pl-page .player-modal{
  position:relative;width:min(1080px,100%);max-height:92vh;overflow:auto;
  background:var(--paper);color:var(--ink);
  border:1px solid var(--line);border-radius:20px;
  box-shadow:0 40px 80px -40px rgba(0,0,0,.7);
  padding:20px;
}
.pl-page .player-close{
  position:absolute;top:16px;right:16px;z-index:2;
  width:40px;height:40px;border-radius:50%;
  border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);
  font-size:20px;line-height:1;cursor:pointer;
  display:grid;place-items:center;
  transition:background .2s,color .2s,border-color .2s;
}
.pl-page .player-close:hover{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.pl-page .player-frame{aspect-ratio:16/9;background:#000;border-radius:14px;overflow:hidden}
.pl-page .player-frame iframe{width:100%;height:100%;border:0;display:block}
.pl-page .player-unavailable{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
  height:100%;color:#fff;text-align:center;padding:24px;
}
.pl-page .player-unavailable strong{font-weight:600;font-size:15px}
.pl-page .player-unavailable a{
  color:var(--red);text-decoration:underline;text-underline-offset:3px;
  font-size:13px;font-weight:600;
}
.pl-page .player-caption{padding:18px 4px 6px}
.pl-page .player-caption h2{font-size:18px;font-weight:600;letter-spacing:-.015em;margin:0 0 6px}
.pl-page .player-caption p{margin:0;font-size:13.5px;color:var(--muted);line-height:1.55}

/* Notice */
.pl-page .share-notice{
  position:fixed;left:50%;bottom:96px;transform:translateX(-50%);
  z-index:70;background:var(--ink);color:var(--paper);
  padding:12px 20px;border-radius:999px;font-size:12.5px;
  letter-spacing:.08em;text-transform:uppercase;font-weight:600;
  box-shadow:0 20px 40px -20px rgba(10,10,10,.5);
  animation:pl-notice-in .25s ease-out;
}
@keyframes pl-notice-in{
  from{opacity:0;transform:translateX(-50%) translateY(8px)}
  to{opacity:1;transform:translateX(-50%) translateY(0)}
}

/* ================= RESPONSIVE ================= */
@media (max-width:820px){
  .pl-detail-art{width:100%}
  .pl-detail-copy h1{font-size:clamp(24px,6vw,34px)}
}
@media (max-width:640px){
  .pl-hero{padding:40px 20px 32px}
  .pl-section{padding:36px 20px 56px}
  .pl-detail{padding:32px 20px 56px}
  .pl-grid{grid-template-columns:1fr 1fr;gap:14px}
  .pl-video-list .latest-card{grid-template-columns:1fr;gap:14px}
  .pl-video-list .video-copy strong{font-size:15.5px}
  .pl-video-list .more-button{position:absolute;top:14px;right:14px}
  .pl-page .player-modal{padding:14px;border-radius:16px}
}
@media (max-width:420px){
  .pl-grid{grid-template-columns:1fr}
}
`;

export default function PlaylistsPage({ playlistId }: { playlistId?: string }) {
  const [watching, setWatching] = useState<Video | null>(null);
  const [shareNotice, setShareNotice] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [revealed, setRevealed] = useState<{ playlistId?: string; ids: string[] }>({ ids: [] });

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

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="pl-page">
        {/* HERO */}
        <header className="pl-hero">
          <div className="pl-hero-inner">
            <nav className="pl-crumbs">
              <Link href="/">Home</Link>
              <span aria-hidden="true">/</span>
              <span>Playlists</span>
            </nav>

            <p className="pl-eyebrow">
              <span className="pl-eyebrow-line" />
              POF Video Library
            </p>

            <h1 className="pl-title pl-display">
              {playlist ? playlist.title : <>The <em>Playlists</em></>}
            </h1>

            <p className="pl-lede">
              {playlist
                ? playlist.channelTitle
                : "Browse every playlist from our connected channels."}
            </p>
          </div>
        </header>

        {!loaded || !detailLoaded ? (
          <section className="pl-section"><CardGridSkeleton /></section>
        ) : playlistId && !playlist ? (
          <section className="pl-empty">
            <p>This playlist is not available.</p>
            <Link href="/playlists">← All playlists</Link>
          </section>
        ) : playlist ? (
          <section className="pl-detail">
            <div className="pl-detail-head">
              <div className="pl-detail-art">
                <img src={playlist.thumbnail} alt="" />
              </div>
              <div className="pl-detail-copy">
                <span className="pl-eyebrow">
                  <span className="pl-eyebrow-line" />
                  Playlist · {playlist.itemCount} videos
                </span>
                <h1>{playlist.title}</h1>
                <p>{playlist.channelTitle}</p>
                {playlist.description && (
                  <p className="pl-detail-desc">{playlist.description}</p>
                )}
              </div>
            </div>

            {!videos.length ? (
              <VideoListSkeleton />
            ) : (
              <div className="pl-video-list">
                {playlistVideoIds.map((id, index) => {
                  const video = videosById.get(id);
                  return (
                    <article className="latest-card" key={`${id}-${index}`}>
                      <button
                        className="video-thumb"
                        onClick={() =>
                          video
                            ? setWatching(video)
                            : window.open(`https://www.youtube.com/watch?v=${id}`, "_blank", "noopener,noreferrer")
                        }
                        aria-label={`Watch ${video?.title ?? "video"}`}
                      >
                        {video && <img src={video.thumbnail} alt="" />}
                        <span className="duration-tag">{formatDuration(video?.duration)}</span>
                        <span className="thumb-play">▶</span>
                      </button>
                      <button
                        className="video-copy"
                        onClick={() =>
                          video
                            ? setWatching(video)
                            : window.open(`https://www.youtube.com/watch?v=${id}`, "_blank", "noopener,noreferrer")
                        }
                      >
                        <strong>
                          {video?.website?.displayTitle || video?.title || "Watch this video on YouTube"}
                        </strong>
                        <time>{video ? formatDate(video.publishedAt) : ""}</time>
                        <span className="video-description">
                          {video?.description?.trim() || video?.channelTitle || "Open on YouTube"}
                        </span>
                      </button>
                      {video && (
                        <button
                          className="more-button"
                          aria-label={`Share ${video.title}`}
                          title="Share video"
                          onClick={() => void shareVideo(video)}
                        >
                          •••
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {hiddenCount > 0 && (
              <button
                className="pl-load-more"
                disabled={loadingMore}
                onClick={() => void loadRemainingVideos()}
              >
                {loadingMore ? "Loading…" : `Load ${hiddenCount} more videos`}
              </button>
            )}

            {visiblePlaylists.filter((item) => item.id !== playlist.id).length > 0 && (
              <section className="pl-related">
                <div className="pl-related-title">
                  <h2 className="pl-h2">You may also like</h2>
                  <Link className="pl-related-link" href="/playlists">
                    View all →
                  </Link>
                </div>
                <div className="pl-grid">
                  {visiblePlaylists
                    .filter((item) => item.id !== playlist.id)
                    .slice(0, 8)
                    .map((item) => (
                      <Link
                        className="pl-card"
                        href={`/playlists/${encodeURIComponent(item.id)}`}
                        key={item.id}
                      >
                        <span className="pl-art">
                          <img src={item.thumbnail} alt="" />
                          <span>{item.itemCount} videos</span>
                        </span>
                        <strong>{item.title}</strong>
                        <small>{item.channelTitle}</small>
                      </Link>
                    ))}
                </div>
              </section>
            )}

            <Link className="pl-detail-back" href="/playlists">← All playlists</Link>
          </section>
        ) : (
          <section className="pl-section">
            <div className="pl-grid">
              {visiblePlaylists.map((item) => (
                <Link
                  className="pl-card"
                  href={`/playlists/${encodeURIComponent(item.id)}`}
                  key={item.id}
                >
                  <span className="pl-art">
                    <img src={item.thumbnail} alt="" />
                    <span>{item.itemCount} videos</span>
                  </span>
                  <strong>{item.title}</strong>
                  <small>{item.channelTitle}</small>
                </Link>
              ))}
            </div>
          </section>
        )}

        {watching && (
          <div
            className="player-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={watching.title}
            onClick={() => setWatching(null)}
          >
            <div className="player-modal" onClick={(event) => event.stopPropagation()}>
              <button className="player-close" aria-label="Close player" onClick={() => setWatching(null)}>×</button>
              <div className="player-frame">
                {watching.embeddable === false ? (
                  <div className="player-unavailable">
                    <strong>This video can only be watched on YouTube.</strong>
                    <a
                      href={`https://www.youtube.com/watch?v=${watching.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open on YouTube
                    </a>
                  </div>
                ) : (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${watching.id}?autoplay=1&rel=0`}
                    title={watching.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                )}
              </div>
              <div className="player-caption">
                <h2>{watching.website?.displayTitle || watching.title}</h2>
                <p>{watching.description?.trim() || watching.channelTitle}</p>
              </div>
            </div>
          </div>
        )}

        {shareNotice && <div className="share-notice" role="status">{shareNotice}</div>}
        <MobileBottomNav current="library" />
      </main>
    </>
  );
}