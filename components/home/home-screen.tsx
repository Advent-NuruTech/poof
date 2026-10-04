"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/sign-in";
import { formatDate, formatDuration, type Channel, type Playlist, type Video } from "@/lib/catalog";

function Icon({ name, size = 22 }: { name: "search" | "user" | "play" | "list" | "grid" | "home" | "camera" | "menu" | "chevron" | "close"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7.5"/><path d="m16.5 16.5 4 4"/></>,
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.7-3.5 3.3-5.5 7.5-5.5s6.8 2 7.5 5.5"/></>,
    play: <><path d="m8 5 12 7-12 7V5Z" fill="currentColor" stroke="none"/></>,
    list: <><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M9 8h8M9 12h8M9 16h8M6 8h.01M6 12h.01M6 16h.01"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" fill="currentColor" stroke="none"/></>,
    camera: <><rect x="3" y="7" width="18" height="13" rx="3"/><path d="m8 7 1.5-3h5L16 7M12 11v5m-2.5-2.5h5"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/></>,
    menu: <><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>, close: <><path d="m18 6-12 12M6 6l12 12"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function SectionTitle({ icon, title, href = "#library", onViewAll }: { icon: "list" | "grid"; title: string; href?: string; onViewAll?: () => void }) {
  return <div className="home-section-title"><h2><Icon name={icon} size={23}/>{title}</h2>{onViewAll ? <button onClick={onViewAll}>View all <Icon name="chevron" size={16}/></button> : <a href={href}>View all <Icon name="chevron" size={16}/></a>}</div>;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export default function HomeScreen() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [authError, setAuthError] = useState("");
  const [watching, setWatching] = useState<Video | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [showAllVideos, setShowAllVideos] = useState(false);
  const [showAllMeetings, setShowAllMeetings] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("Home");
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const activeChannelKey = JSON.stringify(channels.map((channel) => channel.id).sort());
  useEffect(() => onSnapshot(collection(db, "channels"), (snapshot) => {
    setChannels(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as Channel).filter((item) => item.enabled));
  }, () => setChannels([])), []);
  useEffect(() => {
    const ids = JSON.parse(activeChannelKey) as string[];
    if (!ids.length) { setVideos([]); return; }
    const groupRows = new Map<number, Map<string, Video>>();
    const subscriptions = chunks(ids, 30).map((group, groupIndex) => onSnapshot(
      query(collection(db, "videos"), where("catalogChannelIds", "array-contains-any", group), limit(300)),
      (snapshot) => {
        groupRows.set(groupIndex, new Map(snapshot.docs.map((entry) => [entry.id, { ...entry.data(), id: entry.id } as Video])));
        const merged = new Map<string, Video>();
        for (const rows of groupRows.values()) for (const [id, video] of rows) merged.set(id, video);
        setVideos([...merged.values()].filter((video) => !video.website?.hidden && video.availability !== "unavailable").sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 300));
      }, () => setVideos([]),
    ));
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [activeChannelKey]);
  useEffect(() => {
    const ids = JSON.parse(activeChannelKey) as string[];
    if (!ids.length) { setPlaylists([]); return; }
    const groupRows = new Map<number, Map<string, Playlist>>();
    const subscriptions = chunks(ids, 30).map((group, groupIndex) => onSnapshot(
      query(collection(db, "playlists"), where("channelId", "in", group), limit(80)),
      (snapshot) => {
        groupRows.set(groupIndex, new Map(snapshot.docs.map((entry) => [entry.id, { ...entry.data(), id: entry.id } as Playlist])));
        const merged = new Map<string, Playlist>();
        for (const rows of groupRows.values()) for (const [id, playlist] of rows) merged.set(id, playlist);
        setPlaylists([...merged.values()].filter((playlist) => !playlist.website?.hidden));
      }, () => setPlaylists([]),
    ));
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [activeChannelKey]);

  const channelIds = new Set(channels.map((channel) => channel.id));
  const activeVideos = videos.filter((video) => video.catalogChannelIds?.some((id) => channelIds.has(id)));
  const term = search.trim().toLowerCase();
  const latest = term ? activeVideos.filter((video) => `${video.title} ${video.description} ${video.channelTitle}`.toLowerCase().includes(term)) : activeVideos;
  const activePlaylists = playlists.filter((playlist) => channelIds.has(playlist.channelId));
  const live = activeVideos.find((video) => video.liveStatus === "live");
  const heroItems = [...activeVideos.filter((video) => video.liveStatus === "live"), ...activeVideos.filter((video) => video.website?.featured && video.liveStatus !== "live"), ...activeVideos.filter((video) => video.liveStatus !== "live" && !video.website?.featured)].slice(0, 4);
  const heroVideo = heroItems[heroItems.length ? heroIndex % heroItems.length : 0];

  useEffect(() => {
    if (heroItems.length < 2) return;
    const timer = window.setInterval(() => setHeroIndex((index) => (index + 1) % heroItems.length), 5000);
    return () => window.clearInterval(timer);
  }, [heroItems.length]);
  const allTopPlaylists = activePlaylists.filter((playlist) => playlist.website?.featured).concat(activePlaylists.filter((playlist) => !playlist.website?.featured));
  const topPlaylists = allTopPlaylists.slice(0, 8);
  const allPastPlaylists = activePlaylists.filter((playlist) => /meeting|rally|workshop|camp|conference|retreat/i.test(playlist.title));
  const pastPlaylists = showAllMeetings ? allPastPlaylists : allPastPlaylists.slice(0, 8);
  const visibleVideos = showAllVideos ? latest : latest.slice(0, 6);

  function openCategory() {
    setActiveNav("Categories");
    document.getElementById("featured-playlists")?.scrollIntoView({ behavior: "smooth" });
  }

  return <main className="home-app">
    <header className="site-header">
      <a className="brand" href="/" aria-label="Pioneers of Our Faith home"><img src="/images/logo.jpeg" alt=""/><span>Pioneers <b>of Our Faith</b></span></a>
      <nav className="desktop-nav"><a className="nav-current" href="#home">Home</a><a href="/playlists">Playlists</a><a href="#channels">Channels</a><a href="/admin">Manage videos</a></nav>
      <div className="header-actions">{searchOpen && <input autoFocus className="header-search" placeholder="Search recent videos…" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Escape" && setSearchOpen(false)}/>}<button className="header-icon" aria-label="Search videos" onClick={() => { setSearchOpen(!searchOpen); setSearch(""); }}><Icon name={searchOpen ? "close" : "search"} size={27}/></button><button className="header-icon account-trigger" aria-label="Account" onClick={() => setAccountOpen(!accountOpen)}>{user?.photoURL ? <img src={user.photoURL} alt=""/> : <Icon name="user" size={25}/>}</button>
        {accountOpen && <div className="account-menu">{user ? <><strong>{user.displayName ?? "Signed in"}</strong><span>{user.email}</span><a href="/admin">Channel dashboard</a><button onClick={() => signOut(auth)}>Sign out</button></> : <><strong>Welcome</strong><span>Sign in with Google to manage channels.</span>{authError && <span className="auth-error">{authError}</span>}<button onClick={() => void signInWithGoogle().catch((reason) => setAuthError(reason instanceof Error ? reason.message : "Google sign-in failed."))}>Continue with Google</button><a href="/admin">Administrator tools</a></>}</div>}</div>
    </header>
    <section className="hero" id="home" style={{ backgroundImage: heroVideo?.thumbnail ? `linear-gradient(90deg, rgba(5,13,18,.88) 0%, rgba(5,13,18,.48) 42%, rgba(5,13,18,.02) 100%), url("${heroVideo.thumbnail}")` : "radial-gradient(ellipse at 74% 45%, #bd9154 0%, #654c37 17%, transparent 38%), linear-gradient(110deg, #111e24, #293b3f 58%, #11191d)" }}>
      <button className="hero-arrow hero-arrow-left" aria-label="Previous featured video" onClick={() => setHeroIndex((index) => (index + Math.max(heroItems.length, 1) - 1) % Math.max(heroItems.length, 1))}>‹</button>
      <div className="hero-copy"><span className="hero-kicker">{live ? <><i/> LIVE NOW</> : heroVideo ? "FEATURED MESSAGE" : "PIONEERS OF OUR FAITH"}</span><h1>{heroVideo?.title ?? <>Faith for<br/>every season.</>}</h1><p>{heroVideo?.channelTitle ?? "A home for uplifting messages, worship, and Bible study."}</p>{heroVideo ? <button className="watch-button" onClick={() => setWatching(heroVideo)}><Icon name="play" size={16}/> Watch now</button> : <a className="watch-button" href="#latest"><Icon name="play" size={16}/> Explore videos</a>}</div>
      <button className="hero-arrow hero-arrow-right" aria-label="Next featured video" onClick={() => setHeroIndex((index) => (index + 1) % Math.max(heroItems.length, 1))}>›</button>
      <div className="hero-dots">{Array.from({ length: heroItems.length ? Math.min(heroItems.length, 4) : 4 }, (_, dot) => <button key={dot} className={dot === heroIndex % Math.max(heroItems.length, 1) ? "dot-current" : ""} aria-label={`Show featured item ${dot + 1}`} onClick={() => setHeroIndex(dot)}/>)}</div>
    </section>
    <div className="home-content">
      <section className="home-section latest-section" id="latest"><SectionTitle icon="list" title={search ? "Search results" : "Latest Videos"} onViewAll={() => setShowAllVideos(!showAllVideos)}/>
        {visibleVideos.length ? <div className="latest-list">{visibleVideos.map((video) => <article className="latest-card" key={video.id}><button className="video-thumb" onClick={() => setWatching(video)} aria-label={`Watch ${video.title}`}><img src={video.thumbnail} alt=""/><span className="duration-tag">{formatDuration(video.duration)}</span><span className="thumb-play"><Icon name="play" size={17}/></span></button><button className="video-copy" onClick={() => setWatching(video)}><strong>{video.website?.displayTitle || video.title}</strong><time>{formatDate(video.publishedAt)}</time><span>{video.channelTitle}</span></button><button className="more-button" aria-label={`More options for ${video.title}`} onClick={() => setWatching(video)}><Icon name="menu"/></button></article>)}</div> : <div className="empty-home"><span className="empty-video-icon"><Icon name="play" size={19}/></span><div><strong>{search ? "No videos found" : channels.length ? "Your videos are syncing" : "Your next favorite video is on its way"}</strong><p>{search ? "Try another title, topic, or channel." : channels.length ? "New videos will appear here as soon as the channel sync finishes." : "Connect a YouTube channel and its latest videos will appear here."}</p>{!channels.length && <a href="/admin">Connect a channel <Icon name="chevron" size={15}/></a>}</div></div>}</section>
      <section className="home-section" id="featured-playlists"><SectionTitle icon="list" title="Featured Playlists" href="/playlists"/>{topPlaylists.length ? <div className="playlist-strip">{topPlaylists.map((playlist) => <a className="playlist-card" href={`/playlists/${encodeURIComponent(playlist.id)}`} key={playlist.id}><span className="playlist-art"><img src={playlist.thumbnail} alt=""/><span>{playlist.itemCount} videos</span></span><strong>{playlist.title}</strong><small>{playlist.channelTitle}</small></a>)}</div> : <div className="playlist-empty"><Icon name="list" size={20}/><span>Playlists from your connected channels will show up here.</span></div>}</section>
      <section className="home-section past-section" id="library"><SectionTitle icon="grid" title="Past Meetings" onViewAll={() => setShowAllMeetings(!showAllMeetings)}/>{pastPlaylists.length ? <div className="meeting-grid">{pastPlaylists.map((playlist) => <a className="meeting-card" href={`/playlists/${encodeURIComponent(playlist.id)}`} key={playlist.id}><img src={playlist.thumbnail} alt=""/><span className="meeting-gradient"/><span className="meeting-copy"><strong>{playlist.title}</strong><small>{playlist.itemCount} videos · {playlist.channelTitle}</small></span></a>)}</div> : <div className="playlist-empty"><Icon name="grid" size={20}/><span>Meeting series and events will appear here when they are found in your playlists.</span></div>}</section>
      <section className="home-section channels-section" id="channels"><SectionTitle icon="grid" title="Our Channels" href="#channels"/>{channels.length ? <div className="channel-strip">{channels.map((channel) => <a className="public-channel" href={channel.customUrl ? `https://www.youtube.com/${channel.customUrl}` : `https://www.youtube.com/channel/${channel.id}`} target="_blank" rel="noreferrer" key={channel.id}><img src={channel.thumbnail} alt=""/><span><strong>{channel.title}</strong><small>Explore channel</small></span><Icon name="chevron" size={16}/></a>)}</div> : <p className="channel-empty">A growing collection of messages, ministries, and music.</p>}</section>
      <footer className="site-footer" id="contact"><span>© Pioneers Of Our Faith</span><a href="/admin">Channel administration</a></footer>
    </div>
    <nav className="mobile-tabbar" aria-label="Main navigation"><a className={activeNav === "Home" ? "tab-active" : ""} href="#home" onClick={() => setActiveNav("Home")}><Icon name="home" size={24}/><span>Home</span></a><button className={activeNav === "Categories" ? "tab-active" : ""} onClick={openCategory}><Icon name="grid" size={24}/><span>Categories</span></button><button onClick={() => live ? setWatching(live) : document.getElementById("latest")?.scrollIntoView({ behavior: "smooth" })}><Icon name="camera" size={25}/><span>Zoom</span></button><a href="#contact" onClick={() => setActiveNav("Contact")}><Icon name="user" size={24}/><span>Contact</span></a></nav>
    {watching && <div className="player-backdrop" role="dialog" aria-modal="true" aria-label={watching.title} onClick={() => setWatching(null)}><div className="player-modal" onClick={(event) => event.stopPropagation()}><button className="player-close" aria-label="Close player" onClick={() => setWatching(null)}><Icon name="close"/></button><div className="player-frame">{watching.embeddable === false ? <div className="player-unavailable"><strong>This video can only be watched on YouTube.</strong><a href={`https://www.youtube.com/watch?v=${watching.id}`} target="_blank" rel="noreferrer">Open on YouTube</a></div> : <iframe src={`https://www.youtube-nocookie.com/embed/${watching.id}?autoplay=1&rel=0`} title={watching.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>}</div><div className="player-caption"><h2>{watching.website?.displayTitle || watching.title}</h2><p>{watching.channelTitle} · {formatDate(watching.publishedAt)}</p>{watching.description && <p>{watching.description}</p>}</div></div></div>}
    {selectedPlaylist && <div className="player-backdrop playlist-backdrop" role="dialog" aria-modal="true" aria-label={selectedPlaylist.title} onClick={() => setSelectedPlaylist(null)}><div className="playlist-modal" onClick={(event) => event.stopPropagation()}><button className="player-close" aria-label="Close playlist" onClick={() => setSelectedPlaylist(null)}><Icon name="close"/></button><div className="playlist-modal-head"><img src={selectedPlaylist.thumbnail} alt=""/><div><span className="eyebrow">PLAYLIST · {selectedPlaylist.itemCount} VIDEOS</span><h2>{selectedPlaylist.title}</h2><p>{selectedPlaylist.channelTitle}</p></div></div>{selectedPlaylist.description && <p className="playlist-description">{selectedPlaylist.description}</p>}<div className="playlist-video-list">{selectedPlaylist.videoIds.map((id, index) => { const video = videos.find((item) => item.id === id); return video ? <button key={`${id}-${index}`} onClick={() => { setWatching(video); setSelectedPlaylist(null); }}><span className="playlist-order">{String(index + 1).padStart(2, "0")}</span><img src={video.thumbnail} alt=""/><span className="playlist-video-copy"><strong>{video.website?.displayTitle || video.title}</strong><small>{formatDuration(video.duration)} · {video.channelTitle}</small></span><Icon name="play" size={17}/></button> : <a key={`${id}-${index}`} href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer"><span className="playlist-order">{String(index + 1).padStart(2, "0")}</span><span className="missing-video">Open this video on YouTube</span><Icon name="chevron" size={17}/></a>; })}</div></div></div>}
  </main>;
}
