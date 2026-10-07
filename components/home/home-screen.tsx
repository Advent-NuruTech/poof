"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LibraryCategory, LibraryDocument } from "@/lib/library";
import { formatDate, formatDuration, type Channel, type Playlist, type Video } from "@/lib/catalog";
import { collapseMeetingOccurrences, formatMeetingDate, formatMeetingTime, meetingGroups, meetingHref, meetingJoinVisible } from "@/lib/meetings";
import { feedChannels, feedMeetings, feedPlaylists, feedVideos, refreshCatalogFeed, usePublicCatalog } from "@/lib/use-catalog";
import { FEED_CACHE_MS } from "@/lib/catalog-feed-types";
import MeetingCard from "@/components/home/meeting-card";
import MobileBottomNav from "@/components/home/mobile-bottom-nav";
import { CardGridSkeleton, MeetingListSkeleton, VideoListSkeleton } from "@/components/home/skeleton";

// How many cards each homepage section renders. These caps, not the size of the
// Firestore catalog, decide what a visitor downloads, and everything comes from
// the shared snapshot cached for 24 hours by lib/catalog-feed.ts.
const HOME_SECTION_LIMIT = 12;
const ARCHIVE_VIDEO_LIMIT = 15;
const HERO_ITEM_LIMIT = 4;
const LATEST_PAGE_SIZE = 6;
const HOME_STUDY_LIMIT = 6;
const HERO_MEETING_MS = 15_000;
const HERO_VIDEO_MS = 5_000;

function Icon({ name, size = 22 }: { name: "search" | "user" | "play" | "list" | "grid" | "home" | "camera" | "menu" | "chevron" | "close" | "calendar"; size?: number }) {
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
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>, close: <><path d="m18 6-12 12M6 6l12 12"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function SectionTitle({ icon, title, href = "#library", onViewAll }: { icon: "list" | "grid" | "calendar"; title: string; href?: string; onViewAll?: () => void }) {
  return <div className="home-section-title"><h2><Icon name={icon} size={23}/>{title}</h2>{onViewAll ? <button onClick={onViewAll}>View all <Icon name="chevron" size={16}/></button> : <a href={href}>View all <Icon name="chevron" size={16}/></a>}</div>;
}

function archiveRows<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

function ChannelAvatar({ channel }: { channel: Channel }) {
  const [failed, setFailed] = useState(!channel.thumbnail);
  return failed ? <span className="youtube-channel-icon" aria-hidden="true"><span/></span> : <img src={channel.thumbnail} alt="" onError={() => setFailed(true)}/>;
}

export default function HomeScreen() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [watching, setWatching] = useState<Video | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [showAllVideos, setShowAllVideos] = useState(false);
  const [now, setNow] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [shareNotice, setShareNotice] = useState("");
  const [studyCategories, setStudyCategories] = useState<LibraryCategory[]>([]);
  const [studyDocuments, setStudyDocuments] = useState<LibraryDocument[]>([]);
  const [studiesLoaded, setStudiesLoaded] = useState(false);

  // Every public page reads the shared server snapshot cached for 24 hours. No
  // page opens an onSnapshot listener on videos, playlists, channels, or
  // meetings; see lib/catalog-feed.ts for the quota rules behind this.
  const { feed } = usePublicCatalog();
  const [pageVideos, setPageVideos] = useState<Video[] | null>(null);
  const channels = feedChannels(feed);
  const feedVideoRows = feedVideos(feed);
  const playlists = feedPlaylists(feed);
  const meetings = feedMeetings(feed);
  const videos = pageVideos ?? feedVideoRows.slice(0, LATEST_PAGE_SIZE);
  const feedLoaded = feed.fetchedAt !== "";
  const channelsLoaded = feedLoaded || pageVideos !== null;
  const videosLoaded = channelsLoaded;
  const playlistsLoaded = channelsLoaded;
  const meetingsLoaded = channelsLoaded;

  // Keeps a long-lived tab at most one cache window behind without ever forcing
  // an uncached Firestore read: the refresh reads the cached snapshot again.
  useEffect(() => {
    if (!feed.fetchedAt) return;
    if (Date.now() - new Date(feed.fetchedAt).getTime() < FEED_CACHE_MS) return;
    const timer = window.setTimeout(() => { void refreshCatalogFeed(); }, 0);
    return () => window.clearTimeout(timer);
  }, [feed.fetchedAt]);
  useEffect(() => {
    if (!showAllVideos || pageVideos !== null || feed.videos.length <= LATEST_PAGE_SIZE) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void refreshCatalogFeed().then((next) => { if (active && next) setPageVideos(feedVideos(next)); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [showAllVideos, pageVideos, feed.videos.length]);
  useEffect(() => { const initial = window.setTimeout(() => setNow(Date.now()), 0); const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, []);

  // The homepage study shelf reads the same library collections as /library.
  // Documents and categories are small, admin-managed sets, so a single
  // snapshot listener per collection is safe here.
  useEffect(() => onSnapshot(
    collection(db, "libraryDocuments"),
    (snapshot) => { setStudyDocuments(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as LibraryDocument)); setStudiesLoaded(true); },
    () => setStudiesLoaded(true),
  ), []);
  useEffect(() => onSnapshot(
    collection(db, "libraryCategories"),
    (snapshot) => setStudyCategories(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as LibraryCategory)),
    () => setStudyCategories([]),
  ), []);

  const channelIds = new Set(channels.map((channel) => channel.id));
  const activeVideos = videos.filter((video) => video.catalogChannelIds?.some((id) => channelIds.has(id)));
  const currentYear = now ? new Date(now).getFullYear() : 0;
  const videosFromYear = (year: number) => year ? activeVideos.filter((video) => video.publishedAt && new Date(video.publishedAt).getFullYear() === year).slice(0, ARCHIVE_VIDEO_LIMIT) : [];
  const twoYearVideos = videosFromYear(currentYear - 2);
  const fourYearVideos = videosFromYear(currentYear - 4);
  const mostViewedVideos = [...activeVideos].filter((video) => video.statistics?.viewCount !== undefined).sort((a, b) => Number(b.statistics?.viewCount ?? 0) - Number(a.statistics?.viewCount ?? 0)).slice(0, HOME_SECTION_LIMIT);
  const term = search.trim().toLowerCase();
  const latest = term ? activeVideos.filter((video) => `${video.title} ${video.description} ${video.channelTitle}`.toLowerCase().includes(term)) : activeVideos;
  const activePlaylists = playlists.filter((playlist) => channelIds.has(playlist.channelId));
  const live = activeVideos.find((video) => video.liveStatus === "live");
  const heroVideos = [...activeVideos.filter((video) => video.liveStatus === "live"), ...activeVideos.filter((video) => video.website?.featured && video.liveStatus !== "live"), ...activeVideos.filter((video) => video.liveStatus !== "live" && !video.website?.featured)].map((video) => ({ kind: "video" as const, video }));
  const priorityMeetings = meetingGroups(collapseMeetingOccurrences(meetings, now), now).filter((group) => group.status !== "completed").flatMap((group) => group.meetings).map((meeting) => ({ kind: "meeting" as const, meeting }));
  const heroItems = [...priorityMeetings, ...heroVideos].slice(0, HERO_ITEM_LIMIT);
  const heroItem = heroItems[heroItems.length ? heroIndex % heroItems.length : 0];
  const heroVideo = heroItem?.kind === "video" ? heroItem.video : undefined;
  const heroMeeting = heroItem?.kind === "meeting" ? heroItem.meeting : undefined;
  const heroSlideKey = heroMeeting ? `meeting:${heroMeeting.id}` : heroVideo ? `video:${heroVideo.id}` : "empty";
  const heroSlideDuration = heroMeeting ? HERO_MEETING_MS : HERO_VIDEO_MS;

  useEffect(() => {
    if (heroItems.length < 2) return;
    const timer = window.setTimeout(() => setHeroIndex((index) => (index + 1) % heroItems.length), heroSlideDuration);
    return () => window.clearTimeout(timer);
  }, [heroItems.length, heroSlideDuration, heroSlideKey]);
  const allTopPlaylists = activePlaylists.filter((playlist) => playlist.website?.featured).concat(activePlaylists.filter((playlist) => !playlist.website?.featured));
  const topPlaylists = allTopPlaylists.slice(0, 8);
  // Each section is capped before render. The catalog itself may hold thousands
  // of videos; that size must never translate into per-visitor DOM, and nothing
  // below ever re-reads Firestore.
  const meetingGroupsShown = meetingGroups(collapseMeetingOccurrences(meetings, now), now).filter((group) => group.status !== "completed").slice(0, 2).map((group) => ({ ...group, meetings: group.meetings.slice(0, 3) })).filter((group) => group.meetings.length);
  const visibleVideos = showAllVideos ? latest.slice(0, HOME_SECTION_LIMIT) : latest.slice(0, LATEST_PAGE_SIZE);
  // Latest studies: newest first, but anything filed under a Health category is
  // surfaced ahead of the rest so health material leads the shelf.
  const healthCategoryIds = new Set(studyCategories.filter((category) => /health/i.test(category.name)).map((category) => category.id));
  const isHealthStudy = (study: LibraryDocument) => healthCategoryIds.has(study.categoryId) || /health/i.test(study.categoryName ?? "");
  const latestStudies = [...studyDocuments]
    .sort((a, b) => new Date(b.createdAt ?? b.updatedAt ?? 0).getTime() - new Date(a.createdAt ?? a.updatedAt ?? 0).getTime())
    .sort((a, b) => Number(isHealthStudy(b)) - Number(isHealthStudy(a)))
    .slice(0, HOME_STUDY_LIMIT);
  const studyKindLabel = (kind: LibraryDocument["kind"]) => kind === "pdf" ? "PDF" : kind === "doc" ? "DOC" : "NOTE";
  const studyPreviewUrl = (study: LibraryDocument) =>
    study.previewUrl ||
    (study.fileUrl && process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
      ? `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/fetch/pg_1,f_jpg,w_1000/${encodeURIComponent(study.fileUrl)}`
      : study.fileUrl || "");

  async function shareVideo(video: Video) {
    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
    try {
      if (navigator.share) await navigator.share({ url });
      else {
        await navigator.clipboard.writeText(url);
        setShareNotice("Video link copied");
        window.setTimeout(() => setShareNotice(""), 2200);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setShareNotice("Video link copied");
        window.setTimeout(() => setShareNotice(""), 2200);
      } catch { setShareNotice("Could not share this video"); }
    }
  }

  function renderSearchCard(video: Video) {
    return <article className="latest-card" key={video.id}>
      <button className="video-thumb" onClick={() => { setWatching(video); setSearchOpen(false); }} aria-label={`Watch ${video.title}`}><img src={video.thumbnail} alt=""/><span className="duration-tag">{formatDuration(video.duration)}</span><span className="thumb-play"><Icon name="play" size={17}/></span></button>
      <button className="video-copy" onClick={() => { setWatching(video); setSearchOpen(false); }}><strong>{video.website?.displayTitle || video.title}</strong><time>{formatDate(video.publishedAt)}</time><span className="video-description">{video.description?.trim() || video.channelTitle}</span></button>
      <button className="more-button" aria-label={`Share ${video.title}`} title="Share video" onClick={() => void shareVideo(video)}><Icon name="menu"/></button>
    </article>;
  }

  function renderMeetingSlideBody(meeting: (typeof priorityMeetings)[number]["meeting"]) {
    return <>
      <span className="hero-kicker"><i/> MEETING</span>
      <h1>{meeting.title}</h1>
      <p>{formatMeetingDate(meeting.startsAt)} · {formatMeetingTime(meeting)}</p>
      <div className="hero-actions">
        {meetingJoinVisible(meeting, now) ? <a className="watch-button" href={meeting.meetingUrl} target="_blank" rel="noreferrer"><Icon name="play" size={16}/> Join now</a>
          : meeting.meetingType === "onsite" ? <a className="watch-button" href={`/meeting-link-request`}><Icon name="calendar" size={16}/> Request details</a>
          : <a className="watch-button" href={`/meeting-link-request`}><Icon name="calendar" size={16}/> Request meeting link</a>}
        <a className="hero-secondary-button" href={meetingHref(meeting)}>See details</a>
      </div>
    </>;
  }

  return <main className="home-app">
    <header className={`site-header${searchOpen ? " site-header-search" : ""}`}>
      <Link className={`brand${searchOpen ? " brand-search-hidden" : ""}`} href="/" aria-label="Faith of the Pioneers home"><img src="/images/logo.jpeg" alt=""/><span>Faith <b>of the Pioneers</b></span></Link>
      {!searchOpen && <nav className="desktop-nav"><Link className="nav-current" href="/">Home</Link><Link href="/playlists">Playlists</Link><a href="#channels">Channels</a><Link href="/meetings">Zoom</Link><Link href="/library">Library</Link></nav>}
      <div className={`header-actions${searchOpen ? " search-active" : ""}`}>{searchOpen && <input autoFocus className="header-search" aria-label="Search videos" placeholder="Search videos" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setSearchOpen(false); setSearch(""); } }}/>}<button className="header-icon" aria-label={searchOpen ? "Close search" : "Search videos"} onClick={() => { setSearchOpen(!searchOpen); setSearch(""); }}><Icon name={searchOpen ? "close" : "search"} size={27}/></button></div>
    </header>
    {searchOpen && <div className="search-overlay" onClick={() => { setSearchOpen(false); setSearch(""); }}><section className="search-panel" role="dialog" aria-label="Video search results" onClick={(event) => event.stopPropagation()}><div className="search-panel-heading"><strong>{term ? `Results for ${search.trim()}` : "Search videos"}</strong><span>{term ? `${latest.length} ${latest.length === 1 ? "video" : "videos"}` : "Search titles, topics, and channels"}</span></div>{!term ? <p className="search-prompt">Start typing to find a video.</p> : !videosLoaded ? <VideoListSkeleton/> : latest.length ? <div className="search-results">{latest.map(renderSearchCard)}</div> : <div className="search-empty"><strong>No videos found</strong><span>Try another title, topic, or channel.</span></div>}</section></div>}
    <section className="hero" id="home" style={{ backgroundImage: heroVideo?.thumbnail ? `linear-gradient(90deg, rgba(5,13,18,.88) 0%, rgba(5,13,18,.48) 42%, rgba(5,13,18,.02) 100%), url("${heroVideo.thumbnail}")` : "radial-gradient(ellipse at 74% 45%, #bd9154 0%, #654c37 17%, transparent 38%), linear-gradient(110deg, #111e24, #293b3f 58%, #11191d)" }}>
      <button className="hero-arrow hero-arrow-left" aria-label="Previous featured item" disabled={heroItems.length < 2} onClick={() => setHeroIndex((index) => (index + Math.max(heroItems.length, 1) - 1) % Math.max(heroItems.length, 1))}><Icon name="chevron" size={20}/></button>
      <div className="hero-copy">{live && !heroMeeting ? <><span className="hero-kicker"><i/> LIVE NOW</span><h1>{live.title}</h1><p>{live.channelTitle}</p><button className="watch-button" onClick={() => setWatching(live)}><Icon name="play" size={16}/> Watch now</button></>
        : heroMeeting ? renderMeetingSlideBody(heroMeeting)
        : <><span className="hero-kicker">{heroVideo ? "FEATURED MESSAGE" : "FAITH OF THE PIONEERS"}</span><h1>{heroVideo?.title ?? <>Faith for<br/>every season.</>}</h1><p>{heroVideo?.channelTitle ?? "A home for uplifting messages, worship, and Bible study."}</p>{heroVideo ? <button className="watch-button" onClick={() => setWatching(heroVideo)}><Icon name="play" size={16}/> Watch now</button> : <a className="watch-button" href="#latest"><Icon name="play" size={16}/> Explore videos</a>}</>}</div>
      <button className="hero-arrow hero-arrow-right" aria-label="Next featured item" disabled={heroItems.length < 2} onClick={() => setHeroIndex((index) => (index + 1) % Math.max(heroItems.length, 1))}><Icon name="chevron" size={20}/></button>
      <div className="hero-dots">{Array.from({ length: heroItems.length ? Math.min(heroItems.length, 4) : 4 }, (_, dot) => <button key={dot} className={dot === heroIndex % Math.max(heroItems.length, 1) ? "dot-current" : ""} aria-label={`Show featured item ${dot + 1}`} onClick={() => setHeroIndex(dot)}/>)}</div>
    </section>
    <div className="home-content">
      <div className="latest-about-layout">
      <section className="home-section latest-section" id="latest"><SectionTitle icon="list" title={search ? "Search results" : "Latest Videos"} onViewAll={() => setShowAllVideos(!showAllVideos)}/>
        {!videosLoaded ? <VideoListSkeleton/> : visibleVideos.length ? <div className="latest-list">{visibleVideos.map((video) => <article className="latest-card" key={video.id}><button className="video-thumb" onClick={() => setWatching(video)} aria-label={`Watch ${video.title}`}><img src={video.thumbnail} alt=""/><span className="duration-tag">{formatDuration(video.duration)}</span><span className="thumb-play"><Icon name="play" size={17}/></span></button><button className="video-copy" onClick={() => setWatching(video)}><strong>{video.website?.displayTitle || video.title}</strong><time>{formatDate(video.publishedAt)}</time><span className="video-description">{video.description?.trim() || video.channelTitle}</span></button><button className="more-button" aria-label={`Share ${video.title}`} title="Share video" onClick={() => void shareVideo(video)}><Icon name="menu"/></button></article>)}</div> : <div className="empty-home"><span className="empty-video-icon"><Icon name="play" size={19}/></span><div><strong>{search ? "No videos found" : "Videos will appear here soon"}</strong><p>{search ? "Try another title, topic, or channel." : "New videos and messages will be added to the library as they become available."}</p></div></div>}</section>
        <aside className="about-card" aria-labelledby="about-card-title">
          <span className="about-card-eyebrow"><i/> About the ministry</span>
          <h2 id="about-card-title">A faith rooted in Scripture.</h2>
          <p>Faith of the Pioneers is an online fellowship devoted to Scripture, personal testimonies, and the simple, Bible-centered faith of the early Adventist pioneers.</p>
          <p>Join believers around the world for weekly study, worship, and fellowship.</p>
          <div className="about-card-actions"><Link className="about-card-link" href="/about">Discover our ministry <Icon name="chevron" size={15}/></Link><Link className="about-card-cta" href="/meeting-link-request">Join the next meeting</Link></div>
        </aside>
      </div>
      {(!meetingsLoaded || meetingGroupsShown.length > 0) && <section className="home-section meetings-section" id="meetings"><SectionTitle icon="calendar" title="Meetings" href="/meetings"/>{!meetingsLoaded ? <MeetingListSkeleton/> : <div className="meeting-groups">{meetingGroupsShown.map((group) => <div className="meeting-group" key={group.status}>
        <h3 className="meeting-group-title">{group.label}<span>{group.meetings.length}</span></h3>
        <div className="zoom-meeting-list">{group.meetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} now={now}/>)}</div>
      </div>)}</div>}</section>}
      <section className="home-section" id="featured-playlists"><SectionTitle icon="list" title="Featured Playlists" href="/playlists"/>{!playlistsLoaded ? <CardGridSkeleton/> : topPlaylists.length ? <div className="playlist-strip">{topPlaylists.map((playlist) => <Link className="playlist-card" href={`/playlists/${encodeURIComponent(playlist.id)}`} key={playlist.id}><span className="playlist-art"><img src={playlist.thumbnail} alt=""/><span>{playlist.itemCount} videos</span></span><strong>{playlist.title}</strong><small>{playlist.channelTitle}</small></Link>)}</div> : <div className="playlist-empty"><Icon name="list" size={20}/><span>Playlists will appear here as they become available.</span></div>}</section>
      {[{ label: "2 years ago", items: twoYearVideos }, { label: "4 years ago", items: fourYearVideos }, { label: "Most Viewed", items: mostViewedVideos }].map(({ label, items }, archiveIndex) => ((archiveIndex < 2 && (!currentYear || (videosLoaded && !items.length))) || (archiveIndex > 1 && videosLoaded && !items.length)) ? null : <section className="home-section archive-section" key={label}>
        <div className="archive-heading"><h2>{label}</h2></div>
        {!videosLoaded || (archiveIndex < 2 && !currentYear) ? <VideoListSkeleton/> : items.length ? <div className="archive-list">{archiveRows(items, 3).map((row, rowIndex) => <div className={`archive-row${rowIndex % 2 ? " archive-row-reverse" : ""}`} key={`${label}-${rowIndex}`}>
          {row.map((video, itemIndex) => {
            const isFeature = itemIndex === 0;
            const autoPlay = archiveIndex === 0 && rowIndex === 0 && itemIndex === 0 && video.embeddable !== false;
            return <article className={`archive-video${isFeature ? " archive-video-feature" : " archive-video-small"}`} key={video.id}>
              {autoPlay ? <div className="archive-player"><iframe src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&mute=1&rel=0`} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/></div> : <button className="archive-thumb" onClick={() => setWatching(video)} aria-label={`Watch ${video.title}`}><img src={video.thumbnail} alt=""/><span className="archive-play"><Icon name="play" size={18}/></span></button>}
              <button className="archive-copy" onClick={() => setWatching(video)}><strong>{video.website?.displayTitle || video.title}</strong><small>{video.description?.trim() || video.channelTitle}</small><time>{formatDate(video.publishedAt)}</time></button>
            </article>;
          })}
        </div>)}</div> : <div className="playlist-empty"><Icon name="play" size={20}/><span>No videos from {label} are available in the connected channels.</span></div>}
      </section>)}
      <section className="home-section studies-section" id="studies"><SectionTitle icon="list" title="Latest Studies" href="/library"/>{!studiesLoaded ? <CardGridSkeleton/> : latestStudies.length ? <div className="study-grid">{latestStudies.map((study) => <Link className="study-card" href={`/library/${encodeURIComponent(study.id)}`} key={study.id}><span className="study-card-preview"><span className="study-kind">{studyKindLabel(study.kind)}</span>{study.kind === "pdf" && study.fileUrl ? <img src={studyPreviewUrl(study)} alt={`${study.title}, page 1`} loading="lazy"/> : study.kind === "doc" && study.fileUrl ? <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(study.fileUrl)}`} title={`${study.title} first page`} tabIndex={-1}/> : <span className="study-note-preview" dangerouslySetInnerHTML={{ __html: study.contentHtml ?? "" }}/>}<span className="study-card-arrow" aria-hidden="true">&#8594;</span></span><span className="study-card-body"><strong>{study.title}</strong><small>{study.description?.trim() || (study.kind === "note" ? "Read this study note online" : study.fileName || study.categoryName || "Study resource")}</small></span></Link>)}</div> : <div className="playlist-empty"><Icon name="list" size={20}/><span>Study resources will appear here as they are published.</span></div>}</section>
      <section className="home-section channels-section" id="channels"><SectionTitle icon="grid" title="Our Channels" href="#channels"/>{!channelsLoaded ? <CardGridSkeleton/> : channels.length ? <div className="channel-strip">{channels.map((channel) => <a className="public-channel" href={channel.customUrl ? `https://www.youtube.com/${channel.customUrl}` : `https://www.youtube.com/channel/${channel.id}`} target="_blank" rel="noreferrer" key={channel.id}><ChannelAvatar channel={channel}/><span><strong>{channel.title}</strong><small>Explore channel</small></span><Icon name="chevron" size={16}/></a>)}</div> : <p className="channel-empty">A growing collection of messages, ministries, and music.</p>}</section>
    <footer className="site-footer">
      <div className="footer-inner">
        <p className="footer-copyright">© 2026 Pioneers Of Our Faith. All rights reserved.</p>
        <nav className="footer-links" aria-label="Footer navigation">
          <Link href="/doctrine/fundermentalprinciples">Fundamental Principles</Link>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/terms-of-use">Terms of Use</Link>
          <Link href="/cookies-policy">Cookies Policy</Link>
          <Link href="/contact">Contact us</Link>
        </nav>
        <span className="powered-by"><span className="powered-by-text">Powered by Advent Nurutech</span></span>
      </div>
    </footer>
    {shareNotice && <div className="share-notice" role="status">{shareNotice}</div>}
    </div>
    <MobileBottomNav current="home"/>
    {watching && <div className="player-backdrop" role="dialog" aria-modal="true" aria-label={watching.title} onClick={() => setWatching(null)}><div className="player-modal" onClick={(event) => event.stopPropagation()}><button className="player-close" aria-label="Close player" onClick={() => setWatching(null)}><Icon name="close"/></button><div className="player-frame">{watching.embeddable === false ? <div className="player-unavailable"><strong>This video can only be watched on YouTube.</strong><a href={`https://www.youtube.com/watch?v=${watching.id}`} target="_blank" rel="noreferrer">Open on YouTube</a></div> : <iframe src={`https://www.youtube-nocookie.com/embed/${watching.id}?autoplay=1&rel=0`} title={watching.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>}</div><div className="player-caption"><h2>{watching.website?.displayTitle || watching.title}</h2><p>{watching.channelTitle} · {formatDate(watching.publishedAt)}</p>{watching.description && <p>{watching.description}</p>}</div></div></div>}
    {selectedPlaylist && <div className="player-backdrop playlist-backdrop" role="dialog" aria-modal="true" aria-label={selectedPlaylist.title} onClick={() => setSelectedPlaylist(null)}><div className="playlist-modal" onClick={(event) => event.stopPropagation()}><button className="player-close" aria-label="Close playlist" onClick={() => setSelectedPlaylist(null)}><Icon name="close"/></button><div className="playlist-modal-head"><img src={selectedPlaylist.thumbnail} alt=""/><div><span className="eyebrow">PLAYLIST · {selectedPlaylist.itemCount} VIDEOS</span><h2>{selectedPlaylist.title}</h2><p>{selectedPlaylist.channelTitle}</p></div></div>{selectedPlaylist.description && <p className="playlist-description">{selectedPlaylist.description}</p>}<div className="playlist-video-list">{selectedPlaylist.videoIds.map((id, index) => { const video = videos.find((item) => item.id === id); return video ? <button key={`${id}-${index}`} onClick={() => { setWatching(video); setSelectedPlaylist(null); }}><span className="playlist-order">{String(index + 1).padStart(2, "0")}</span><img src={video.thumbnail} alt=""/><span className="playlist-video-copy"><strong>{video.website?.displayTitle || video.title}</strong><small>{formatDuration(video.duration)} · {video.channelTitle}</small></span><Icon name="play" size={17}/></button> : <a key={`${id}-${index}`} href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer"><span className="playlist-order">{String(index + 1).padStart(2, "0")}</span><span className="missing-video">Open this video on YouTube</span><Icon name="chevron" size={17}/></a>; })}</div></div></div>}
  </main>;
}
