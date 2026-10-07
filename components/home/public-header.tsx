"use client";

import Link from "next/link";

type PublicHeaderProps = { searchOpen: boolean; search: string; onSearchOpenChange: (open: boolean) => void; onSearchChange: (value: string) => void };

function HeaderIcon({ name }: { name: "search" | "close" }) {
  return name === "close" ? <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg> : <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>;
}

/** Shared public-site masthead. Search state remains owned by the home screen. */
export default function PublicHeader({ searchOpen, search, onSearchOpenChange, onSearchChange }: PublicHeaderProps) {
  const closeSearch = () => { onSearchOpenChange(false); onSearchChange(""); };
  return <header className={`site-header${searchOpen ? " site-header-search" : ""}`}>
    <Link className={`brand${searchOpen ? " brand-search-hidden" : ""}`} href="/" aria-label="Faith of the Pioneers home"><img src="/images/logo.jpeg" alt="" /><span>Faith <b>of the Pioneers</b></span></Link>
    {!searchOpen && <nav className="desktop-nav" aria-label="Main navigation"><Link className="nav-current" href="/">Home</Link><Link href="/playlists">Playlists</Link><a href="#channels">Channels</a><Link href="/meetings">Zoom</Link><Link href="/library">Library</Link></nav>}
    <div className={`header-actions${searchOpen ? " search-active" : ""}`}>{searchOpen && <input autoFocus className="header-search" aria-label="Search videos" placeholder="Search videos" value={search} onChange={(event) => onSearchChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") closeSearch(); }} />}<button className="header-icon" aria-label={searchOpen ? "Close search" : "Search videos"} onClick={() => searchOpen ? closeSearch() : onSearchOpenChange(true)}><HeaderIcon name={searchOpen ? "close" : "search"} /></button></div>
  </header>;
}
