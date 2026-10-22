"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sharePublicUrl } from "@/lib/share";
import { automaticPreviewText, sanitizeRichText } from "@/lib/rich-text";
import type { Testimony } from "@/lib/testimonies";
import PublicHeader from "@/components/home/public-header";
import SiteFooter from "@/components/home/site-footer";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";

function Avatar({ name, url }: { name: string; url: string }) {
  const [failed, setFailed] = useState(false);
  return <span className="testimony-avatar">{url && !failed ? <img src={url} alt="" onError={() => setFailed(true)}/> : (name.trim().charAt(0).toUpperCase() || "?")}</span>;
}
function StoryImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : <img src={src} alt="" loading="lazy" onError={() => setFailed(true)}/>;
}
export default function Testimonies({ home = false }: { home?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Testimony[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    const ref = collection(db, "testimonies");
    const request = home ? query(ref, orderBy("createdAt", "desc"), limit(3)) : query(ref, orderBy("createdAt", "desc"));
    getDocs(request).then((snapshot) => { if (active) { setItems(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Testimony)); setStatus("ready"); } }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [home]);
  useEffect(() => {
    if (!home && status === "ready" && window.location.hash) {
      const id = decodeURIComponent(window.location.hash.slice(1));
      document.getElementById(id)?.scrollIntoView();
    }
  }, [home, status, items]);
  async function shareTestimony(item: Testimony) {
    await sharePublicUrl({
      url: `${window.location.origin}/testimonies#testimony-${encodeURIComponent(item.id)}`,
      title: item.title,
      text: automaticPreviewText(item.content, 180),
    });
  }
  const content = <>
    {home ? <div className="home-section-title"><h2>Latest Testimonies</h2><Link href="/testimonies">View all testimonies →</Link></div> : <header className="testimony-page-heading"><span>STORIES OF FAITH</span><h1>Testimonies</h1><p>Stories of faith, hope, and God’s work in our lives.</p></header>}
    {status === "loading" ? <p>Loading testimonies…</p> : status === "error" ? <p>Testimonies could not be loaded. Please try again later.</p> : items.length === 0 ? <p>Testimonies will appear here soon.</p> : <div className={home ? "testimony-grid" : "testimony-list"}>{items.map((item) => <article className="testimony-card" id={`testimony-${item.id}`} key={item.id}>
      <div className="testimony-person"><Avatar name={item.name} url={item.profileUrl}/><strong>{item.name}</strong></div><h2>{item.title}</h2>
      <button className="testimony-share" type="button" onClick={() => void shareTestimony(item)} aria-label={`Share ${item.title}`} title="Share testimony"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg><span>Share</span></button>
      {home ? <><p>{automaticPreviewText(item.content, 200)}</p><Link href={`/testimonies#testimony-${encodeURIComponent(item.id)}`}>Read testimony →</Link></> : <>{item.beforeImages?.length > 0 && <div className="testimony-images">{item.beforeImages.map((src, index) => <StoryImage key={`${src}-${index}`} src={src}/>)}</div>}<div className="testimony-content" onErrorCapture={(event) => { if (event.target instanceof HTMLImageElement) event.target.style.display = "none"; }} dangerouslySetInnerHTML={{ __html: sanitizeRichText(item.content) }}/>{item.afterImages?.length > 0 && <div className="testimony-images">{item.afterImages.map((src, index) => <StoryImage key={`${src}-${index}`} src={src}/>)}</div>}</>}
    </article>)}</div>}
  </>;
  return home ? <section className="home-section testimonies-home">{content}</section> : <main className="home-app"><PublicHeader searchOpen={false} search="" onSearchOpenChange={() => { router.push("/"); }} onSearchChange={() => {}}/><div className="testimony-page">{content}</div><SiteFooter/><MobileBottomNav current="home"/></main>;
}
