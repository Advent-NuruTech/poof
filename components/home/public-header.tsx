"use client";

import Link from "next/link";

type PublicHeaderProps = {
  searchOpen: boolean;
  search: string;
  onSearchOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
};

const CSS = `
.zm-header{
  --ink:#0a0a0a;--paper:#fff;--paper-2:#f6f6f4;--paper-3:#efefec;
  --line:rgba(10,10,10,.12);--line-strong:rgba(10,10,10,.28);
  --muted:#6b6b68;--muted-2:#9a9a96;--red:#d0021b;
  position:sticky;top:0;z-index:60;
  background:rgba(255,255,255,.94);
  backdrop-filter:blur(16px) saturate(140%);
  -webkit-backdrop-filter:blur(16px) saturate(140%);
  border-bottom:1px solid var(--line);
  color:var(--ink);
  font-family:"Helvetica Neue",Helvetica,"Inter","Segoe UI",Arial,sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
.zm-header *{box-sizing:border-box}
.zm-header-inner{
  max-width:1120px;margin:0 auto;
  padding:14px 24px;
  display:flex;align-items:center;gap:20px;
}

/* Brand — stacked two-line name like the reference image */
.zm-brand{
  display:inline-flex;align-items:center;gap:14px;
  text-decoration:none;color:var(--ink);
  flex:0 0 auto;
  transition:opacity .2s;
}
.zm-brand img{
  width:56px;height:56px;border-radius:50%;
  object-fit:cover;background:var(--paper-2);
  flex:0 0 auto;
}
.zm-brand-text{
  display:flex;flex-direction:column;
  line-height:1.02;
  letter-spacing:-.03em;
  font-weight:700;
  font-size:clamp(20px,2.4vw,26px);
  color:var(--ink);
}
.zm-brand-text span{display:block;white-space:nowrap}
.zm-brand.is-hidden{opacity:0;pointer-events:none;width:0;overflow:hidden}

/* Nav */
.zm-nav{
  display:flex;align-items:center;gap:4px;flex:1 1 auto;justify-content:center;
  overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;
}
.zm-nav::-webkit-scrollbar{display:none}
.zm-nav a{
  font-size:12.5px;letter-spacing:.02em;
  color:var(--ink);text-decoration:none;white-space:nowrap;
  padding:9px 16px;border-radius:999px;
  border:1px solid transparent;
  outline:0;
  transition:background .2s,color .2s,border-color .2s;
}
.zm-nav a:hover{
  border-color:var(--line-strong);
  background:var(--paper);
}
.zm-nav a:focus{outline:0}
.zm-nav a:focus-visible{
  outline:0;border-color:var(--red);
  box-shadow:0 0 0 2px rgba(208,2,27,.35);
}
.zm-nav a.is-current{
  background:var(--ink);color:var(--paper);border-color:var(--ink);
}
.zm-nav a.is-current::before{
  content:"";display:inline-block;width:6px;height:6px;background:var(--red);
  border-radius:50%;transform:translateY(-1px);margin-right:8px;
}

/* Donate */
.zm-nav a.zm-donate{
  border:1px solid var(--red);color:var(--red);
  background:transparent;font-weight:600;
  display:inline-flex;align-items:center;gap:7px;
}
.zm-nav a.zm-donate::before{
  content:"";display:inline-block;width:6px;height:6px;background:var(--red);
  border-radius:50%;transform:translateY(-1px);
}
.zm-nav a.zm-donate:hover{
  background:var(--red);color:var(--paper);border-color:var(--red);
}
.zm-nav a.zm-donate:hover::before{background:var(--paper)}
.zm-nav a.zm-donate:focus-visible{
  outline:0;border-color:var(--red);
  box-shadow:0 0 0 2px rgba(208,2,27,.35);
}

/* Actions */
.zm-actions{
  display:flex;align-items:center;gap:8px;
  margin-left:auto;flex:0 0 auto;
  min-width:0;
}
.zm-header.is-searching .zm-actions{flex:1 1 auto;width:100%}

/* Search field — full width on mobile when open */
.zm-search-input{
  flex:1 1 auto;min-width:0;width:100%;
  font:inherit;font-size:14px;color:var(--ink);
  background:var(--paper);
  border:1px solid var(--line-strong);
  border-radius:999px;
  padding:11px 18px;height:44px;
  outline:0;
  appearance:none;
  -webkit-appearance:none;
  box-shadow:none;
  transition:border-color .2s;
}
.zm-search-input::placeholder{color:var(--muted-2)}
.zm-search-input:focus,
.zm-search-input:focus-visible,
.zm-search-input:active{
  outline:0 !important;
  outline-offset:0;
  border-color:var(--red);
  box-shadow:none;
  -webkit-tap-highlight-color:transparent;
}
.zm-search-input::-webkit-search-decoration,
.zm-search-input::-webkit-search-cancel-button,
.zm-search-input::-webkit-search-results-button,
.zm-search-input::-webkit-search-results-decoration{
  -webkit-appearance:none;display:none;
}
.zm-search-input:-webkit-autofill,
.zm-search-input:-webkit-autofill:hover,
.zm-search-input:-webkit-autofill:focus{
  -webkit-text-fill-color:var(--ink);
  -webkit-box-shadow:0 0 0 1000px var(--paper) inset;
  transition:background-color 9999s ease-in-out 0s;
}

.zm-icon-btn{
  width:44px;height:44px;flex:0 0 auto;
  display:grid;place-items:center;
  border:1px solid var(--line-strong);border-radius:999px;
  background:var(--paper);color:var(--ink);
  cursor:pointer;
  padding:0;
  outline:0;
  appearance:none;
  -webkit-appearance:none;
  box-shadow:none;
  -webkit-tap-highlight-color:transparent;
  transition:border-color .2s,color .2s,background .2s;
}
.zm-icon-btn:hover{
  border-color:var(--ink);
  background:var(--paper-2);
}
.zm-icon-btn:focus,
.zm-icon-btn:focus-visible,
.zm-icon-btn:active{
  outline:0 !important;
  border-color:var(--red);
  box-shadow:none;
}
.zm-icon-btn svg{width:20px;height:20px;display:block}

/* Mobile-only donate pill */
.zm-donate-mobile{display:none}

/* ===== MOBILE ===== */
@media (max-width:900px){
  .zm-header-inner{padding:12px 16px;gap:10px;flex-wrap:nowrap}

  .zm-nav{display:none}

  /* Brand stays visible, stacked name preserved */
  .zm-brand{display:inline-flex;gap:10px;min-width:0}
  .zm-brand img{width:44px;height:44px}
  .zm-brand-text{
    font-size:17px;
    line-height:1.05;
  }

  /* Give mobile search the whole masthead, including the keyboard-safe input width. */
  .zm-header.is-searching .zm-brand{display:none}
  .zm-header.is-searching .zm-actions{flex:1 1 0%;width:auto;min-width:0}
  .zm-header.is-searching .zm-search-input{display:block;min-width:0;font-size:16px}

  .zm-actions{margin-left:auto;gap:8px;flex:0 0 auto}
  .zm-header.is-searching .zm-donate-mobile{display:none}

  .zm-donate-mobile{
    display:inline-flex;align-items:center;gap:7px;
    font-size:12px;font-weight:600;letter-spacing:.02em;
    color:var(--red);text-decoration:none;white-space:nowrap;
    border:1px solid var(--red);border-radius:999px;
    padding:10px 14px;height:44px;
    outline:0;
    -webkit-tap-highlight-color:transparent;
    transition:background .2s,color .2s,border-color .2s;
  }
  .zm-donate-mobile::before{
    content:"";display:inline-block;width:6px;height:6px;background:var(--red);
    border-radius:50%;transform:translateY(-1px);
  }
  .zm-donate-mobile:hover{
    background:var(--red);color:var(--paper);border-color:var(--red);
  }
  .zm-donate-mobile:hover::before{background:var(--paper)}
  .zm-donate-mobile:focus,
  .zm-donate-mobile:focus-visible{
    outline:0;border-color:var(--red);
    box-shadow:0 0 0 2px rgba(208,2,27,.35);
  }
}

@media (max-width:480px){
  .zm-header-inner{padding:10px 14px;gap:8px}
  .zm-brand{gap:8px}
  .zm-brand img{width:38px;height:38px}
  .zm-brand-text{font-size:15px}
  .zm-icon-btn{width:40px;height:40px}
  .zm-icon-btn svg{width:18px;height:18px}
  .zm-donate-mobile{padding:9px 12px;height:40px;font-size:11.5px}
}

@media (max-width:380px){
  .zm-brand-text{font-size:13.5px}
  .zm-brand img{width:34px;height:34px}
  .zm-donate-mobile span{display:none}
  .zm-donate-mobile{padding:9px 10px}
}
`;

function HeaderIcon({ name }: { name: "search" | "close" }) {
  return name === "close" ? (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

/** Shared public-site masthead. Search state remains owned by the home screen. */
export default function PublicHeader({
  searchOpen,
  search,
  onSearchOpenChange,
  onSearchChange,
}: PublicHeaderProps) {
  const closeSearch = () => {
    onSearchOpenChange(false);
    onSearchChange("");
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className={`zm-header${searchOpen ? " is-searching" : ""}`}>
        <div className="zm-header-inner">
          <Link
            className={`zm-brand${searchOpen ? " is-hidden" : ""}`}
            href="/"
            aria-label="Faith of the Pioneers home"
          >
            <img src="/images/logo.jpeg" alt="" />
            <span className="zm-brand-text">
              <span>Faith</span>
              <span>of the Pioneers</span>
            </span>
          </Link>

          {!searchOpen && (
            <nav className="zm-nav" aria-label="Main navigation">
              <Link className="is-current" href="/">
                Home
              </Link>
              <Link href="/playlists">Playlists</Link>
              <a href="#channels">Channels</a>
              <Link href="/meetings">Zoom</Link>
              <Link href="/library">Library</Link>
              <Link className="zm-donate" href="/donate">
                Donate
              </Link>
            </nav>
          )}

          <div className="zm-actions">
            {searchOpen && (
              <input
                autoFocus
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={120}
                className="zm-search-input"
                aria-label="Search videos"
                placeholder="Search videos by title, topic, or channel"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") closeSearch();
                }}
              />
            )}

            <button
              className="zm-icon-btn"
              aria-label={searchOpen ? "Close search" : "Search videos"}
              onClick={() =>
                searchOpen ? closeSearch() : onSearchOpenChange(true)
              }
              type="button"
            >
              <HeaderIcon name={searchOpen ? "close" : "search"} />
            </button>

            {!searchOpen && (
              <Link className="zm-donate-mobile" href="/donate">
                Donate
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}