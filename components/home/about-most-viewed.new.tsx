"use client";

import { useMemo } from "react";
import { formatDate } from "@/lib/catalog";
import { feedVideos, usePublicCatalog } from "@/lib/use-catalog";

export default function AboutMostViewed() {
  // Reads the shared 24-hour snapshot instead of an independent live listener on
  // the videos collection. The previous listener loaded up to 300 videos on
  // every /about visit, on top of the homepage already reading the same data.
  const { feed } = usePublicCatalog();
  const loaded = feed.fetchedAt !== "";
  const videos = feedVideos(feed);

  const mostViewed = useMemo(() => videos.filter((video) => video.availability !== "unavailable" && video.statistics?.viewCount !== undefined).sort((a, b) => Number(b.statistics?.viewCount ?? 0) - Number(a.statistics?.viewCount ?? 0)).slice(0, 6), [videos]);

  return <section className="about-most-viewed" aria-labelledby="about-most-viewed-title">
    <div className="about-most-viewed-heading"><span className="about-section-eyebrow">FROM THE VIDEO LIBRARY</span><h2 id="about-most-viewed-title">Most Viewed Videos</h2><p>Explore the messages visitors return to most often.</p></div>
    {!loaded ? <div className="about-most-viewed-state">Loading videos...</div> : mostViewed.length ? <div className="about-most-viewed-grid">{mostViewed.map((video, index) => <a className="about-most-viewed-card" href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`} target="_blank" rel="noreferrer" key={video.id}><span className="about-most-viewed-rank">{String(index + 1).padStart(2, "0")}</span><img src={video.thumbnail} alt="" /><span className="about-most-viewed-copy"><strong>{video.website?.displayTitle || video.title}</strong><small>{video.channelTitle} · {formatDate(video.publishedAt)}</small></span></a>)}</div> : <div className="about-most-viewed-state">Most viewed videos will appear here as the library grows.</div>}
  </section>;
}
