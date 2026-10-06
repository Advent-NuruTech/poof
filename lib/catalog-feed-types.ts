/**
 * Shared catalog feed types and cache-window constants.
 *
 * This module is deliberately NEUTRAL: it imports nothing, so it is safe to
 * import from both server and client code.
 *
 * Why it is separate from lib/catalog-feed.ts:
 *  - lib/catalog-feed.ts uses `cacheLife`, which is a Server Component API. If a
 *    client component imports that file — even for a type — Next.js follows the
 *    import into the browser bundle and the build fails with
 *    "You're importing a module that depends on cacheLife".
 *  - Client components therefore import TYPES from here and the fetch hook from
 *    lib/use-catalog.ts, and never touch lib/catalog-feed.ts.
 *  - The 24-hour cache window lives here so both sides agree on it without the
 *    client pulling in any server-only code.
 */

export type FeedVideo = {
  id: string;
  title: string;
  description?: string;
  thumbnail: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  duration?: string;
  liveStatus?: string;
  playlistIds?: string[];
  catalogChannelIds?: string[];
  availability?: "available" | "unavailable";
  embeddable?: boolean;
  statistics?: { viewCount?: number; likeCount?: number; commentCount?: number };
  website?: { hidden?: boolean; featured?: boolean; displayTitle?: string; category?: string };
};

export type FeedPlaylist = {
  id: string;
  title: string;
  description?: string;
  thumbnail: string;
  channelId: string;
  channelTitle: string;
  videoIds: string[];
  itemCount: number;
  website?: { hidden?: boolean; featured?: boolean; category?: string };
};

export type FeedChannel = {
  id: string;
  title: string;
  description?: string;
  thumbnail: string;
  customUrl?: string;
  enabled: boolean;
};

export type FeedMeeting = {
  id: string;
  title: string;
  description?: string;
  posterUrl?: string;
  startsAt: string;
  endsAt: string;
  meetingType?: "online" | "onsite";
  meetingUrl?: string;
  venue?: string;
  timeZone?: string;
  recurrence?: { frequency: "weekly"; days: number[]; until?: string };
  sourceId?: string;
  occurrenceDate?: string;
};

export type PublicCatalogFeed = {
  channels: FeedChannel[];
  videos: FeedVideo[];
  playlists: FeedPlaylist[];
  meetings: FeedMeeting[];
  fetchedAt: string;
  truncated: boolean;
};

/**
 * The project's mandatory public-read cache window: 24 hours.
 *
 * This is the ONE place that number is defined. next.config.ts feeds it to the
 * `catalogFeed` cacheLife profile, app/api/catalog/route.ts uses it for the
 * `s-maxage` header, and the public pages use it to decide when a long-lived tab
 * should re-read the cache. Changing it here changes all of them together —
 * which is the point, because an accidental drop back to minutes is exactly how
 * the Firestore free tier gets exhausted again.
 */
export const FEED_CACHE_SECONDS = 24 * 60 * 60;

/** The same window in milliseconds, for client-side refresh timers. */
export const FEED_CACHE_MS = FEED_CACHE_SECONDS * 1000;

/** Cache-Control header for the catalog endpoint, derived from the window. */
export const FEED_CACHE_CONTROL = `public, s-maxage=${FEED_CACHE_SECONDS}, stale-while-revalidate=3600`;

export const EMPTY_CATALOG_FEED: PublicCatalogFeed = { channels: [], videos: [], playlists: [], meetings: [], fetchedAt: "", truncated: false };