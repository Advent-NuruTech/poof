"use client";

import { collection, limit, onSnapshot, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { formatDate, type Video } from "@/lib/catalog";

export default function AboutMostViewed() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => onSnapshot(query(collection(db, "videos"), limit(300)), (snapshot) => {
    setVideos(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Video));
    setLoaded(true);
  }, () => { setVideos([]); setLoaded(true); }), []);

  const mostViewed = useMemo(() => videos.filter((video) => video.availability !== "unavailable" && video.statistics?.viewCount !== undefined).sort((a, b) => Number(b.statistics?.viewCount ?? 0) - Number(a.statistics?.viewCount ?? 0)).slice(0, 6), [videos]);

  return <section className="about-most-viewed" aria-labelledby="about-most-viewed-title">
    <div className="about-most-viewed-heading"><span className="about-section-eyebrow">FROM THE VIDEO LIBRARY</span><h2 id="about-most-viewed-title">Most Viewed Videos</h2><p>Explore the messages visitors return to most often.</p></div>
    {!loaded ? <div className="about-most-viewed-state">Loading videos...</div> : mostViewed.length ? <div className="about-most-viewed-grid">{mostViewed.map((video, index) => <a className="about-most-viewed-card" href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`} target="_blank" rel="noreferrer" key={video.id}><span className="about-most-viewed-rank">{String(index + 1).padStart(2, "0")}</span><img src={video.thumbnail} alt=""/><span className="about-most-viewed-copy"><strong>{video.website?.displayTitle || video.title}</strong><small>{video.channelTitle} · {formatDate(video.publishedAt)}</small></span></a>)}</div> : <div className="about-most-viewed-state">Most viewed videos will appear here as the library grows.</div>}
  </section>;
}
