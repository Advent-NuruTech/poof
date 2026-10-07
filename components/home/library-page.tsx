"use client";

import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import type { LibraryCategory, LibraryDocument } from "@/lib/library";
import { feedPlaylists, usePublicCatalog } from "@/lib/use-catalog";
import { collection, onSnapshot } from "firebase/firestore";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";
import PdfDocument from "@/components/home/pdf-document";
import { sharePublicUrl } from "@/lib/share";

const CSS = `
.lib-page{
  --ink:#0a0a0a;--ink-2:#1a1a1a;--paper:#fff;--paper-2:#f6f6f4;--paper-3:#efefec;
  --line:rgba(10,10,10,.12);--line-strong:rgba(10,10,10,.28);
  --muted:#6b6b68;--muted-2:#9a9a96;--red:#d0021b;
  background:var(--paper);color:var(--ink);min-height:100vh;
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
.lib-page *{box-sizing:border-box}

/* Zoom-style display face for titles */
.lib-display{
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  font-weight:500;letter-spacing:-.045em;line-height:.95;color:var(--ink);
}

.lib-eyebrow{display:inline-flex;align-items:center;gap:10px;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0}
.lib-eyebrow-line{display:inline-block;width:26px;height:1px;background:var(--red)}
.lib-h2{font-family:"Helvetica Neue",Helvetica,Inter,sans-serif;font-weight:500;font-size:clamp(26px,3vw,40px);letter-spacing:-.03em;margin:8px 0 0;line-height:1.05}
.lib-dot{width:3px;height:3px;border-radius:50%;background:var(--muted-2);display:inline-block}
.lib-dot-sm{width:2px;height:2px;border-radius:50%;background:var(--muted-2);display:inline-block;margin:0 6px;vertical-align:middle}

/* ============ HERO ============ */
.lib-hero{
  position:relative;padding:64px 24px 48px;text-align:center;overflow:hidden;
  background:
    radial-gradient(900px 340px at 50% -20%,rgba(208,2,27,.06),transparent 60%),
    radial-gradient(1200px 500px at 50% 0%,rgba(10,10,10,.05),transparent 65%),
    linear-gradient(180deg,#fbfbf9 0%,#fff 100%);
  border-bottom:1px solid var(--line);
}
.lib-hero::before{
  content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;
  background-image:
    linear-gradient(to right,rgba(10,10,10,.045) 1px,transparent 1px),
    linear-gradient(to bottom,rgba(10,10,10,.045) 1px,transparent 1px);
  background-size:56px 56px;
  mask-image:radial-gradient(circle at 50% 30%,#000 0%,transparent 70%);
  -webkit-mask-image:radial-gradient(circle at 50% 30%,#000 0%,transparent 70%);
}
.lib-hero::after{
  content:"";position:absolute;left:50%;bottom:0;transform:translateX(-50%);
  width:min(560px,70%);height:1px;
  background:linear-gradient(90deg,transparent,var(--red),transparent);opacity:.55;
}
.lib-hero-inner{position:relative;max-width:1120px;margin:0 auto;z-index:1}

.lib-crumbs{display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:22px}
.lib-crumbs a{color:var(--ink);text-decoration:none;border-bottom:1px solid transparent;transition:border-color .2s}
.lib-crumbs a:hover{border-color:var(--red)}

.lib-title{font-size:clamp(48px,8vw,108px);margin:14px 0 18px}
.lib-title em{font-style:normal;color:var(--red);font-weight:500}

.lib-lede{font-size:clamp(15px,1.3vw,17px);line-height:1.6;color:var(--muted);max-width:56ch;margin:0 auto 40px}

.lib-hero-meta{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:22px;font-size:12.5px;color:var(--muted);letter-spacing:.02em}
.lib-hero-meta strong{color:var(--ink);font-weight:600}

/* ============ FLOATING SEARCH + CATEGORIES BAR ============ */
.lib-searchbar-wrap{
  position:sticky;top:0;z-index:50;
  padding:14px 24px;
  transition:padding .25s ease,background .25s ease,box-shadow .25s ease,border-color .25s ease;
  border-bottom:1px solid transparent;
  background:transparent;
}
.lib-searchbar-wrap.is-floating{
  padding:10px 24px;
  background:rgba(255,255,255,.82);
  backdrop-filter:blur(16px) saturate(140%);
  -webkit-backdrop-filter:blur(16px) saturate(140%);
  box-shadow:0 1px 0 rgba(10,10,10,.06),0 14px 40px -28px rgba(10,10,10,.35);
  border-bottom:1px solid var(--line);
}
.lib-searchbar{
  max-width:1120px;margin:0 auto;
  display:flex;align-items:center;gap:14px;
}
.lib-search{
  position:relative;display:flex;align-items:center;flex:1 1 auto;min-width:0;
  background:var(--paper);border:1px solid var(--line-strong);border-radius:999px;
  padding:0 20px;height:56px;
  box-shadow:0 1px 2px rgba(10,10,10,.04);
  transition:border-color .2s,box-shadow .2s,height .25s ease;
}
.lib-searchbar-wrap.is-floating .lib-search{height:48px;box-shadow:0 1px 2px rgba(10,10,10,.06)}
.lib-search:focus-within{border-color:var(--ink);box-shadow:0 0 0 4px rgba(208,2,27,.10)}
.lib-search-icon{width:18px;height:18px;color:var(--muted);flex:0 0 auto}
.lib-search input{flex:1;border:0;outline:0;background:transparent;font:inherit;font-size:15px;color:var(--ink);padding:0 12px;height:100%;min-width:0}
.lib-search input::placeholder{color:var(--muted-2)}
.lib-search-clear{border:0;background:transparent;color:var(--muted);font-size:22px;line-height:1;cursor:pointer;padding:0 4px}
.lib-search-clear:hover{color:var(--red)}

/* Category chip rail (right of search) */
.lib-cat-rail{
  display:flex;align-items:center;gap:8px;flex:0 1 auto;
  overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;
  padding:4px 2px;max-width:56%;
}
.lib-cat-rail::-webkit-scrollbar{display:none}
.lib-chip{
  flex:0 0 auto;
  border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);
  padding:9px 16px;border-radius:999px;font:inherit;font-size:12.5px;letter-spacing:.02em;
  cursor:pointer;white-space:nowrap;
  transition:background .2s,color .2s,border-color .2s,transform .15s;
}
.lib-chip:hover{border-color:var(--ink);transform:translateY(-1px)}
.lib-chip.is-active{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.lib-chip.is-active::before{
  content:"";display:inline-block;width:6px;height:6px;background:var(--red);
  border-radius:50%;margin-right:8px;vertical-align:middle;transform:translateY(-1px);
}

/* Secondary sub-category row */
.lib-subcats{
  max-width:1120px;margin:12px auto 0;
  display:flex;align-items:center;gap:14px;flex-wrap:wrap;
  padding-top:12px;border-top:1px dashed var(--line);
}
.lib-subcats-label{font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--muted);font-weight:600}
.lib-subcats-row{display:flex;flex-wrap:wrap;gap:8px}
.lib-chip-sm{
  border:1px solid var(--line);background:transparent;color:var(--ink);
  padding:6px 12px;border-radius:999px;font:inherit;font-size:11.5px;cursor:pointer;
  transition:background .2s,color .2s,border-color .2s;
}
.lib-chip-sm:hover{border-color:var(--ink)}
.lib-chip-sm.is-active{background:var(--paper-3);border-color:var(--ink);color:var(--ink);font-weight:600}

/* ============ SECTIONS ============ */
.lib-section{max-width:1120px;margin:0 auto;padding:56px 24px 40px}
.lib-section-alt{border-top:1px solid var(--line);margin-top:32px;padding-top:64px;background:linear-gradient(180deg,#fbfbf9,#fff)}
.lib-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:32px;flex-wrap:wrap}
.lib-link{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);text-decoration:none;padding-bottom:4px;border-bottom:1px solid var(--line-strong);transition:color .2s,border-color .2s}
.lib-link:hover{color:var(--red);border-color:var(--red)}
.lib-link-svg{width:15px;height:15px;transition:transform .2s}
.lib-link:hover .lib-link-svg{transform:translateX(3px)}

/* Grid */
.lib-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:28px}
.lib-card{position:relative;display:flex;flex-direction:column;text-decoration:none;color:inherit;background:var(--paper);border:1px solid var(--line);border-radius:14px;overflow:hidden;transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s,border-color .25s}
.lib-card:hover{transform:translateY(-4px);border-color:var(--line-strong);box-shadow:0 10px 30px -12px rgba(10,10,10,.18)}
.lib-card-thumb{position:relative;aspect-ratio:4/5;background:var(--paper-2);overflow:hidden;border-bottom:1px solid var(--line)}
.lib-card-thumb img,.lib-card-thumb iframe{width:100%;height:100%;border:0;object-fit:cover;display:block;transition:transform .5s}
.lib-card:hover .lib-card-thumb img{transform:scale(1.04)}
.lib-card-kind{position:absolute;top:12px;left:12px;z-index:2;background:var(--paper);color:var(--ink);font-size:10px;letter-spacing:.18em;font-weight:700;padding:5px 9px;border-radius:4px;border:1px solid var(--line-strong)}
.lib-card-kind::before{content:"";display:inline-block;width:5px;height:5px;background:var(--red);border-radius:50%;margin-right:6px;vertical-align:middle;transform:translateY(-1px)}
.lib-card-arrow{position:absolute;bottom:12px;right:12px;z-index:2;width:34px;height:34px;border-radius:50%;background:var(--ink);color:var(--paper);display:grid;place-items:center;opacity:0;transform:translateY(6px) scale(.9);transition:opacity .25s,transform .25s,background .2s}
.lib-card:hover .lib-card-arrow{opacity:1;transform:translateY(0) scale(1);background:var(--red)}
.lib-card-arrow-svg{width:16px;height:16px}
.lib-card-note{padding:18px;font-size:11px;line-height:1.5;color:var(--muted);height:100%;overflow:hidden}
.lib-card-body{padding:16px 18px 20px}
.lib-card-title{display:block;font-weight:600;font-size:16.5px;line-height:1.28;letter-spacing:-.015em;margin-bottom:6px}
.lib-card-desc{margin:0;font-size:13px;line-height:1.5;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* Playlists */
.lib-playlist-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px}
.lib-playlist{display:flex;flex-direction:column;text-decoration:none;color:inherit;background:var(--paper);border:1px solid var(--line);border-radius:14px;overflow:hidden;transition:transform .25s,box-shadow .25s,border-color .25s}
.lib-playlist:hover{transform:translateY(-3px);border-color:var(--line-strong);box-shadow:0 10px 30px -12px rgba(10,10,10,.18)}
.lib-playlist-thumb{position:relative;aspect-ratio:16/9;background:var(--ink);overflow:hidden}
.lib-playlist-thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s}
.lib-playlist:hover .lib-playlist-thumb img{transform:scale(1.04)}
.lib-playlist-play{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(180deg,rgba(10,10,10,.15),rgba(10,10,10,.45))}
.lib-playlist-play-svg{width:22px;height:22px;color:var(--paper);filter:drop-shadow(0 2px 8px rgba(0,0,0,.4))}
.lib-playlist-body{padding:14px 16px 18px}
.lib-playlist-body strong{display:block;font-size:15.5px;font-weight:600;line-height:1.3;letter-spacing:-.01em;margin-bottom:4px}
.lib-playlist-body small{font-size:12px;color:var(--muted);letter-spacing:.02em}

.lib-empty{padding:48px 0;text-align:center;color:var(--muted);font-size:14px}
.lib-empty-lg{padding:120px 24px}
.lib-empty-lg h1{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-weight:500;font-size:clamp(32px,4vw,52px);letter-spacing:-.03em;color:var(--ink);margin:0 0 20px}

.lib-skeleton-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:28px}
.lib-skeleton-card{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--paper)}
.lib-skeleton-thumb{aspect-ratio:4/5;background:linear-gradient(90deg,#f0f0ee,#e6e6e3,#f0f0ee);background-size:200% 100%;animation:lib-shimmer 1.4s infinite}
.lib-skeleton-line{height:12px;margin:16px 18px 0;background:linear-gradient(90deg,#f0f0ee,#e6e6e3,#f0f0ee);background-size:200% 100%;animation:lib-shimmer 1.4s infinite;border-radius:4px}
.lib-skeleton-line.short{width:60%;margin-bottom:20px}
@keyframes lib-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* Reader */
.lib-reader-bar{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:16px;padding:12px 20px;background:rgba(255,255,255,.85);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.lib-reader-back{display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:var(--ink);font-size:12.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:8px 12px;border-radius:8px;transition:background .2s}
.lib-reader-back:hover{background:var(--paper-2)}
.lib-reader-back-svg{width:16px;height:16px}
.lib-reader-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.lib-reader-title strong{font-size:15.5px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lib-reader-sub{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.lib-reader-actions{display:flex;align-items:center;gap:10px}
.lib-zoom{display:flex;align-items:center;gap:4px;border:1px solid var(--line-strong);border-radius:999px;padding:4px}
.lib-zoom button{width:32px;height:32px;border-radius:50%;border:0;background:transparent;color:var(--ink);cursor:pointer;display:grid;place-items:center;transition:background .2s,color .2s}
.lib-zoom button:hover{background:var(--ink);color:var(--paper)}
.lib-zoom span{font-size:12px;font-weight:600;min-width:44px;text-align:center;letter-spacing:.04em}
.lib-zoom-svg{width:14px;height:14px}
.lib-icon-btn{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line-strong);background:transparent;color:var(--ink);padding:10px 16px;border-radius:999px;font:inherit;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.lib-icon-btn:hover{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.lib-icon-btn:hover .lib-icon-btn-svg{color:var(--red)}
.lib-icon-btn-svg{width:15px;height:15px;transition:color .2s}

.lib-reader-sheet{max-width:820px;margin:0 auto;padding:80px 24px 120px}
.lib-reader-sheet-head{margin-bottom:48px;padding-bottom:32px;border-bottom:1px solid var(--line)}
.lib-reader-sheet-head h1{font-weight:500;font-size:clamp(32px,4.5vw,56px);line-height:1.05;letter-spacing:-.035em;margin:14px 0 16px}
.lib-reader-desc{font-size:17px;line-height:1.65;color:var(--muted);margin:0}
.lib-reader-rich{font-size:17px;line-height:1.75;color:var(--ink)}
.lib-reader-rich h1,.lib-reader-rich h2,.lib-reader-rich h3{font-weight:600;letter-spacing:-.02em;margin:1.6em 0 .6em}
.lib-reader-rich p{margin:0 0 1.1em}
.lib-reader-rich a{color:var(--red);text-decoration:underline;text-underline-offset:3px}
.lib-reader-rich blockquote{border-left:3px solid var(--red);padding-left:20px;margin:1.4em 0;font-style:italic;color:var(--muted)}
.lib-reader-rich img{max-width:100%;height:auto;border-radius:8px;margin:1em 0}

.lib-reader-frame{max-width:1100px;margin:0 auto;padding:40px 24px 80px}
.lib-reader-frame iframe{width:100%;height:80vh;border:1px solid var(--line);border-radius:12px;background:var(--paper-2)}
.lib-reader-frame-note{text-align:center;font-size:13px;color:var(--muted);margin-top:16px}
.lib-reader-frame-note a{color:var(--red);text-decoration:underline;text-underline-offset:3px}

@media (max-width:900px){
  .lib-cat-rail{max-width:100%}
}
@media (max-width:720px){
  .lib-hero{padding:44px 20px 32px}
  .lib-searchbar{flex-direction:column;align-items:stretch;gap:10px}
  .lib-cat-rail{max-width:100%;padding-bottom:6px}
  .lib-section{padding:40px 20px 24px}
  .lib-grid,.lib-playlist-grid,.lib-skeleton-grid{gap:16px}
  .lib-reader-bar{flex-wrap:wrap;gap:10px;padding:10px 14px}
  .lib-reader-title{order:3;flex-basis:100%}
  .lib-reader-actions{margin-left:auto}
  .lib-icon-btn span{display:none}
  .lib-reader-sheet{padding:48px 20px 80px}
}
`;

const Icon = {
  Search: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  ),
  ArrowLeft: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5m6-7-7 7 7 7" />
    </svg>
  ),
  ArrowRight: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14m-6-7 7 7-7 7" />
    </svg>
  ),
  Share: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.2" />
    </svg>
  ),
  Download: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
    </svg>
  ),
  Minus: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
  ),
  Plus: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
  ),
  Play: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
  ),
};

export default function LibraryPage({ documentId }: { documentId?: string }) {
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [current, setCurrent] = useState<LibraryDocument | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [floating, setFloating] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { feed } = usePublicCatalog();
  const playlists = feedPlaylists(feed).filter((item) => !item.website?.hidden);

  useEffect(
    () =>
      onSnapshot(
        collection(db, "libraryCategories"),
        (s) => setCategories(s.docs.map((x) => ({ ...x.data(), id: x.id }) as LibraryCategory)),
        (e) => setError(e.message),
      ),
    [],
  );

  useEffect(
    () =>
      onSnapshot(
        collection(db, "libraryDocuments"),
        (s) => {
          setDocuments(s.docs.map((x) => ({ ...x.data(), id: x.id }) as LibraryDocument));
          setLoading(false);
        },
        (e) => {
          setError(e.message);
          setLoading(false);
        },
      ),
    [],
  );

  useEffect(() => {
    if (!documentId) {
      setCurrent(null);
      return;
    }
    let active = true;
    setLoading(true);
    getDoc(doc(db, "libraryDocuments", documentId))
      .then((snapshot) => {
        if (active) {
          setCurrent(snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as LibraryDocument) : null);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (active) {
          setError(e instanceof Error ? e.message : "Could not open this resource.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [documentId]);

  /* Floating search bar on scroll */
  useEffect(() => {
    if (documentId) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setFloating(!entry.isIntersecting),
      { rootMargin: "0px 0px -80% 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [documentId]);

  const visible = useMemo(
    () =>
      documents.filter(
        (item) =>
          (filter === "all" || item.categoryId === filter) &&
          `${item.title} ${item.description ?? ""} ${item.categoryName}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [documents, filter, search],
  );

  const topCategories = categories.filter((item) => !item.parentId);
  const children = (id: string) => categories.filter((item) => item.parentId === id);
  const activeParent = topCategories.find(
    (p) => p.id === filter || children(p.id).some((c) => c.id === filter),
  );

  const target = current ?? documents.find((item) => item.id === documentId);
  const officeUrl = target?.fileUrl
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(target.fileUrl)}`
    : "";
  const cloudinaryName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  const previewUrl = (item: LibraryDocument) =>
    item.previewUrl ||
    (item.fileUrl
      ? cloudinaryName
        ? `https://res.cloudinary.com/${cloudinaryName}/image/fetch/pg_1,f_jpg,w_1000/${encodeURIComponent(item.fileUrl)}`
        : item.fileUrl
      : "");

  async function shareStudy() {
    if (!target) return;
    await sharePublicUrl(`${window.location.origin}/library/${encodeURIComponent(target.id)}`);
  }

  const kindLabel = (k?: string) =>
    k === "pdf" ? "PDF" : k === "doc" ? "DOC" : k === "note" ? "NOTE" : "FILE";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className={`lib-page${documentId ? " lib-reader" : ""}`}>
        {!documentId ? (
          <>
            {/* HERO */}
            <header className="lib-hero">
              <div className="lib-hero-inner">
                <nav className="lib-crumbs">
                  <Link href="/">Home</Link>
                  <span aria-hidden="true">/</span>
                  <span>Library</span>
                </nav>

                <p className="lib-eyebrow">
                  <span className="lib-eyebrow-line" />
                  Faith of the Pioneers
                </p>

                <h1 className="lib-title lib-display">
                  The <em>Library</em>
                </h1>

                <p className="lib-lede">
                  Study resources, reading notes, and video playlists — curated for depth,
                  clarity, and quiet reflection.
                </p>

                <div className="lib-hero-meta">
                  <span><strong>{documents.length}</strong> resources</span>
                  <span className="lib-dot" />
                  <span><strong>{playlists.length}</strong> playlists</span>
                  <span className="lib-dot" />
                  <span><strong>{categories.length}</strong> categories</span>
                </div>
              </div>
            </header>

            {/* Sentinel for floating searchbar */}
            <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />

            {/* FLOATING SEARCH + CATEGORY NAV */}
            <div className={`lib-searchbar-wrap${floating ? " is-floating" : ""}`}>
              <div className="lib-searchbar">
                <div className="lib-search">
                  <Icon.Search className="lib-search-icon" />
                  <input
                    aria-label="Search library"
                    placeholder="Search resources and playlists…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button className="lib-search-clear" onClick={() => setSearch("")} aria-label="Clear search">
                      ×
                    </button>
                  )}
                </div>

                <div className="lib-cat-rail" role="tablist" aria-label="Category navigation">
                  <button
                    role="tab"
                    aria-selected={filter === "all"}
                    className={`lib-chip${filter === "all" ? " is-active" : ""}`}
                    onClick={() => setFilter("all")}
                  >
                    All
                  </button>
                  {topCategories.map((cat) => (
                    <button
                      key={cat.id}
                      role="tab"
                      aria-selected={filter === cat.id}
                      className={`lib-chip${filter === cat.id ? " is-active" : ""}`}
                      onClick={() => setFilter(cat.id)}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-category row for the active parent */}
              {activeParent && children(activeParent.id).length > 0 && (
                <div className="lib-subcats">
                  <span className="lib-subcats-label">{activeParent.name}</span>
                  <div className="lib-subcats-row">
                    <button
                      className={`lib-chip-sm${filter === activeParent.id ? " is-active" : ""}`}
                      onClick={() => setFilter(activeParent.id)}
                    >
                      All
                    </button>
                    {children(activeParent.id).map((child) => (
                      <button
                        key={child.id}
                        className={`lib-chip-sm${filter === child.id ? " is-active" : ""}`}
                        onClick={() => setFilter(child.id)}
                      >
                        {child.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RESOURCES */}
            <section className="lib-section">
              <div className="lib-section-head">
                <div>
                  <p className="lib-eyebrow">
                    <span className="lib-eyebrow-line" />
                    Read &amp; Study
                  </p>
                  <h2 className="lib-h2">Resources</h2>
                </div>
              </div>

              {error && <p className="lib-empty">{error}</p>}

              {loading ? (
                <div className="lib-skeleton-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div className="lib-skeleton-card" key={i}>
                      <div className="lib-skeleton-thumb" />
                      <div className="lib-skeleton-line" />
                      <div className="lib-skeleton-line short" />
                    </div>
                  ))}
                </div>
              ) : visible.length ? (
                <div className="lib-grid">
                  {visible.map((item) => (
                    <a className="lib-card" href={`/library/${encodeURIComponent(item.id)}`} key={item.id}>
                      <div className="lib-card-thumb">
                        <span className="lib-card-kind">{kindLabel(item.kind)}</span>
                        {item.kind === "pdf" && item.fileUrl ? (
                          <img src={previewUrl(item)} alt={`${item.title}, page 1`} loading="lazy" />
                        ) : item.kind === "doc" && item.fileUrl ? (
                          <iframe
                            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(item.fileUrl)}`}
                            title={`${item.title} first page`}
                            tabIndex={-1}
                          />
                        ) : (
                          <div
                            className="lib-card-note"
                            dangerouslySetInnerHTML={{ __html: item.contentHtml ?? "" }}
                          />
                        )}
                        <span className="lib-card-arrow" aria-hidden="true">
                          <Icon.ArrowRight className="lib-card-arrow-svg" />
                        </span>
                      </div>

                      <div className="lib-card-body">
                        <strong className="lib-card-title">{item.title}</strong>
                        <p className="lib-card-desc">
                          {item.description || (item.kind === "note" ? "Read this study note online" : item.fileName)}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="lib-empty">No resources match this search yet.</p>
              )}
            </section>

            {/* PLAYLISTS */}
            <section className="lib-section lib-section-alt">
              <div className="lib-section-head">
                <div>
                  <p className="lib-eyebrow">
                    <span className="lib-eyebrow-line" />
                    Watch &amp; Learn
                  </p>
                  <h2 className="lib-h2">Playlists</h2>
                </div>
                <Link className="lib-link" href="/playlists">
                  All playlists <Icon.ArrowRight className="lib-link-svg" />
                </Link>
              </div>

              {playlists.length ? (
                <div className="lib-playlist-grid">
                  {playlists.map((item) => (
                    <a
                      className="lib-playlist"
                      href={`/playlists/${encodeURIComponent(item.id)}`}
                      key={item.id}
                    >
                      <div className="lib-playlist-thumb">
                        <img src={item.thumbnail} alt="" />
                        <span className="lib-playlist-play" aria-hidden="true">
                          <Icon.Play className="lib-playlist-play-svg" />
                        </span>
                      </div>
                      <div className="lib-playlist-body">
                        <strong>{item.title}</strong>
                        <small>
                          {item.itemCount} videos <span className="lib-dot-sm" /> {item.channelTitle}
                        </small>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="lib-empty">Video playlists will appear here when available.</p>
              )}
            </section>
          </>
        ) : (
          <>
            {/* READER */}
            <header className="lib-reader-bar">
              <Link href="/library" className="lib-reader-back">
                <Icon.ArrowLeft className="lib-reader-back-svg" />
                <span>Library</span>
              </Link>

              <div className="lib-reader-title">
                <strong>{target?.title ?? (loading ? "Loading…" : "Resource unavailable")}</strong>
                <span className="lib-reader-sub">{kindLabel(target?.kind)} · Read online</span>
              </div>

              <div className="lib-reader-actions">
                <div className="lib-zoom">
                  <button aria-label="Zoom out" onClick={() => setZoom((n) => Math.max(60, n - 10))}>
                    <Icon.Minus className="lib-zoom-svg" />
                  </button>
                  <span>{zoom}%</span>
                  <button aria-label="Zoom in" onClick={() => setZoom((n) => Math.min(160, n + 10))}>
                    <Icon.Plus className="lib-zoom-svg" />
                  </button>
                </div>

                {target && (
                  <button
                    className="lib-icon-btn"
                    type="button"
                    onClick={() => void shareStudy()}
                    aria-label={`Share ${target.title}`}
                    title={`Share ${target.title}`}
                  >
                    <Icon.Share className="lib-icon-btn-svg" />
                    <span>Share</span>
                  </button>
                )}

                {target?.fileUrl && (
                  <a
                    className="lib-icon-btn"
                    href={`/api/library/download?url=${encodeURIComponent(target.fileUrl)}&name=${encodeURIComponent(target.fileName ?? target.title)}`}
                    aria-label="Download file"
                  >
                    <Icon.Download className="lib-icon-btn-svg" />
                    <span>Download</span>
                  </a>
                )}
              </div>
            </header>

            {error && <p className="lib-empty">{error}</p>}

            {!loading && target?.kind === "note" && (
              <article className="lib-reader-sheet">
                <div className="lib-reader-sheet-head">
                  <p className="lib-eyebrow">
                    <span className="lib-eyebrow-line" />
                    Study Note
                  </p>
                  <h1 className="lib-display">{target.title}</h1>
                  {target.description && <p className="lib-reader-desc">{target.description}</p>}
                </div>
                <div
                  className="lib-reader-rich"
                  style={{ zoom: `${zoom}%` }}
                  dangerouslySetInnerHTML={{ __html: target.contentHtml ?? "" }}
                />
              </article>
            )}

            {!loading && target?.kind === "pdf" && target.fileUrl && (
              <PdfDocument
                key={target.fileUrl}
                fileUrl={target.fileUrl}
                fileName={target.fileName ?? target.title}
                zoom={zoom}
              />
            )}

            {!loading && target?.kind === "doc" && target.fileUrl && (
              <div className="lib-reader-frame">
                <iframe src={officeUrl} title={target.title} />
                <p className="lib-reader-frame-note">
                  If the preview is unavailable,{" "}
                  <a href={`/api/library/download?url=${encodeURIComponent(target.fileUrl)}&name=${encodeURIComponent(target.fileName ?? target.title)}`}>
                    download the Word document
                  </a>
                  .
                </p>
              </div>
            )}

            {!loading && !target && (
              <section className="lib-empty lib-empty-lg">
                <h1 className="lib-display">Resource not found</h1>
                <Link href="/library" className="lib-link">
                  Back to library <Icon.ArrowRight className="lib-link-svg" />
                </Link>
              </section>
            )}
          </>
        )}

        <MobileBottomNav current="library" />
      </main>
    </>
  );
}