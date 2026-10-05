"use client";

import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import type { LibraryCategory, LibraryDocument } from "@/lib/library";
import type { Playlist } from "@/lib/catalog";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";

export default function LibraryPage({ documentId }: { documentId?: string }) {
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [current, setCurrent] = useState<LibraryDocument | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => onSnapshot(collection(db, "libraryCategories"), (s) => setCategories(s.docs.map((x) => ({ ...x.data(), id: x.id }) as LibraryCategory)), (e) => setError(e.message)), []);
  useEffect(() => onSnapshot(collection(db, "libraryDocuments"), (s) => { setDocuments(s.docs.map((x) => ({ ...x.data(), id: x.id }) as LibraryDocument)); setLoading(false); }, (e) => { setError(e.message); setLoading(false); }), []);
  useEffect(() => onSnapshot(collection(db, "playlists"), (s) => setPlaylists(s.docs.map((x) => ({ ...x.data(), id: x.id }) as Playlist).filter((x) => !x.website?.hidden)), () => setPlaylists([])), []);
  useEffect(() => {
    if (!documentId) { setCurrent(null); return; }
    let active = true; setLoading(true);
    getDoc(doc(db, "libraryDocuments", documentId)).then((snapshot) => { if (active) { setCurrent(snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as LibraryDocument) : null); setLoading(false); } }).catch((e: unknown) => { if (active) { setError(e instanceof Error ? e.message : "Could not open this resource."); setLoading(false); } });
    return () => { active = false; };
  }, [documentId]);
  const visible = useMemo(() => documents.filter((item) => (filter === "all" || item.categoryId === filter) && `${item.title} ${item.description ?? ""} ${item.categoryName}`.toLowerCase().includes(search.toLowerCase())), [documents, filter, search]);
  const topCategories = categories.filter((item) => !item.parentId);
  const children = (id: string) => categories.filter((item) => item.parentId === id);
  const target = current ?? documents.find((item) => item.id === documentId);
  const officeUrl = target?.fileUrl ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(target.fileUrl)}` : "";
  return <main className={`library-page${documentId ? " library-reader-page" : ""}`}>
    {!documentId ? <><header className="library-header"><a href="/">← Home</a><span className="eyebrow">FAITH OF THE PIONEERS</span><h1>Library</h1><p>Study resources, reading notes, and video playlists in one place.</p><label className="library-search"><span aria-hidden="true">⌕</span><input aria-label="Search library" placeholder="Search resources and playlists" value={search} onChange={(e) => setSearch(e.target.value)}/></label></header>
      <section className="library-section"><div className="library-section-title"><div><span className="eyebrow">READ AND STUDY</span><h2>Resources</h2></div><select aria-label="Filter resources by category" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.parentId ? `${categories.find((parent) => parent.id === item.parentId)?.name ?? ""} / ` : ""}{item.name}</option>)}</select></div>
        {error && <p className="library-empty">{error}</p>}{loading ? <p className="library-empty">Loading library…</p> : visible.length ? <div className="library-resource-grid">{visible.map((item) => <a className="library-resource-card" href={`/library/${encodeURIComponent(item.id)}`} key={item.id}><span className="library-file-badge">{item.kind === "note" ? "NOTE" : item.kind.toUpperCase()}</span><span className="library-card-category">{item.categoryName}</span><strong>{item.title}</strong><p>{item.description || (item.kind === "note" ? "Read this study note online" : item.fileName)}</p><span className="library-card-link">Read online <span aria-hidden="true">→</span></span></a>)}</div> : <p className="library-empty">No resources match this search yet.</p>}
        {topCategories.map((parent) => { const groups = [parent, ...children(parent.id)]; const rows = visible.filter((item) => groups.some((c) => c.id === item.categoryId)); return rows.length ? <div className="library-category-group" key={parent.id}><h3>{parent.name}</h3><div className="library-topic-row">{children(parent.id).map((child) => <button key={child.id} className={filter === child.id ? "topic-active" : ""} onClick={() => setFilter(filter === child.id ? "all" : child.id)}>{child.name}</button>)}</div></div> : null; })}
      </section>
      <section className="library-section library-playlists"><div className="library-section-title"><div><span className="eyebrow">WATCH AND LEARN</span><h2>Playlists</h2></div><a href="/playlists">All playlists →</a></div>{playlists.length ? <div className="library-playlist-grid">{playlists.map((item) => <a className="library-playlist-card" href={`/playlists/${encodeURIComponent(item.id)}`} key={item.id}><img src={item.thumbnail} alt=""/><span><strong>{item.title}</strong><small>{item.itemCount} videos · {item.channelTitle}</small></span></a>)}</div> : <p className="library-empty">Video playlists will appear here when available.</p>}</section>
    </> : <><header className="reader-toolbar"><a href="/library" className="reader-back">← <span>Library</span></a><div className="reader-title"><strong>{target?.title ?? (loading ? "Loading…" : "Resource unavailable")}</strong><span>Read online</span></div><div className="reader-zoom"><button aria-label="Zoom out" onClick={() => setZoom((n) => Math.max(60, n - 10))}>−</button><span>{zoom}%</span><button aria-label="Zoom in" onClick={() => setZoom((n) => Math.min(160, n + 10))}>＋</button></div>{target?.fileUrl && <a className="reader-download" href={target.fileUrl} download={target.fileName} aria-label="Download file">↓</a>}</header>
      {error && <p className="library-empty">{error}</p>}{!loading && target?.kind === "note" && <article className="reader-sheet"><h1>{target.title}</h1>{target.description && <p className="reader-description">{target.description}</p>}<div className="reader-rich-content" style={{ zoom: `${zoom}%` }} dangerouslySetInnerHTML={{ __html: target.contentHtml ?? "" }}/></article>}
      {!loading && target?.kind === "pdf" && target.fileUrl && <div className="reader-file-frame"><iframe src={`${target.fileUrl}#toolbar=0&view=FitH`} title={target.title}/></div>}
      {!loading && target?.kind === "doc" && target.fileUrl && <div className="reader-file-frame"><iframe src={officeUrl} title={target.title}/><p>If the preview is unavailable, <a href={target.fileUrl} download={target.fileName}>download the Word document</a>.</p></div>}
      {!loading && !target && <section className="library-empty reader-empty"><h1>Resource not found</h1><a href="/library">Back to library</a></section>}
    </>}
    <MobileBottomNav current="library"/>
  </main>;
}
