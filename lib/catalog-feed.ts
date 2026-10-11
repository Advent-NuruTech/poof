import { cacheLife } from "next/cache";

import type { FeedChannel, FeedMeeting, FeedPlaylist, FeedVideo, PublicCatalogFeed } from "@/lib/catalog-feed-types";
import { EMPTY_CATALOG_FEED, MOST_VIEWED_VIDEO_LIMIT } from "@/lib/catalog-feed-types";

/**
 * The public catalog snapshot, read from Firestore once and then cached
 * server-side for 24 hours by the `catalogFeed` cacheLife profile.
 *
 * SERVER-ONLY. This module imports `cacheLife`, which is a Server Component API,
 * so it must never be reachable from a client component — Next.js would pull it
 * into the browser bundle and fail the build. Client code imports the TYPES and
 * the constants from lib/catalog-feed-types.ts and the fetch hook from
 * lib/use-catalog.ts instead.
 *
 * The quota rules behind this file:
 *  - Public catalog data is the largest consumer of the Firestore free tier.
 *    Reading it per visitor exhausts the daily allowance in a few dozen page
 *    views, so every public read goes through this cached snapshot.
 *  - No `onSnapshot` listener may be added here. A live listener re-delivers
 *    every document to every visitor on every sync write, which is what
 *    exhausted the project quota before.
 *  - Reads are one-shot and bounded per collection: recent videos are capped
 *    at MAX_VIDEO_FEED_ROWS; most-viewed candidates are capped per channel;
 *    other collections are capped at MAX_FEED_ROWS.
 */

export type { FeedChannel, FeedMeeting, FeedPlaylist, FeedVideo, PublicCatalogFeed } from "@/lib/catalog-feed-types";
export { EMPTY_CATALOG_FEED, FEED_CACHE_CONTROL, FEED_CACHE_MS, FEED_CACHE_SECONDS } from "@/lib/catalog-feed-types";

/** Hard ceiling on documents pulled per collection, regardless of catalog size. */
export const MAX_FEED_ROWS = 900;
/** Keep the public video feed focused on recent uploads and bounded to 100 reads. */
export const MAX_VIDEO_FEED_ROWS = 100;

const FEED_TIMEOUT_MS = 8000;

type RestDocument = { name?: string; fields?: Record<string, unknown> };

type RestValue = { stringValue: string } | { integerValue: string };

function documentId(name?: string) {
  if (!name) return "";
  return name.slice(name.lastIndexOf("/") + 1);
}

type WireValue = { [key: string]: unknown };

function fieldValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return undefined;
  const wire = value as WireValue;
  if ("stringValue" in wire) return wire.stringValue;
  if ("booleanValue" in wire) return wire.booleanValue;
  if ("integerValue" in wire) return Number(wire.integerValue);
  if ("doubleValue" in wire) return Number(wire.doubleValue);
  if ("timestampValue" in wire) return wire.timestampValue;
  if ("nullValue" in wire) return null;
  if ("arrayValue" in wire) {
    const values = (wire.arrayValue as { values?: unknown[] } | undefined)?.values ?? [];
    return values.map(fieldValue);
  }
  if ("mapValue" in wire) return decodeFields((wire.mapValue as { fields?: Record<string, unknown> } | undefined)?.fields ?? {});
  return undefined;
}

function decodeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) row[key] = fieldValue(value);
  return row;
}

async function readMostViewedVideos(channelIds: string[]): Promise<FeedVideo[]> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey || !channelIds.length) return [];

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery?key=${encodeURIComponent(apiKey)}`;
  const results = await Promise.all(channelIds.map(async (channelId) => {
    const structuredQuery = {
      from: [{ collectionId: "videos" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "catalogChannelIds" },
          op: "ARRAY_CONTAINS",
          value: { stringValue: channelId } satisfies RestValue,
        },
      },
      orderBy: [{ field: { fieldPath: "statistics.viewCount" }, direction: "DESCENDING" }],
      limit: MOST_VIEWED_VIDEO_LIMIT,
    };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structuredQuery }),
        cache: "no-store",
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      });
      if (!response.ok) {
        console.error(`Could not load most-viewed videos for channel ${channelId}: Firestore returned ${response.status}.`);
        return [];
      }
      const body = await response.json() as Array<{ document?: RestDocument }>;
      return body.flatMap(({ document }) => {
        const id = documentId(document?.name);
        if (!id || !document?.fields) return [];
        return [{ id, ...decodeFields(document.fields) } as FeedVideo];
      });
    } catch (error) {
      console.error(`Could not load most-viewed videos for channel ${channelId}.`, error);
      return [];
    }
  }));

  const uniqueVideos = new Map<string, FeedVideo>();
  for (const video of results.flat()) {
    if (video.availability === "unavailable" || video.website?.hidden === true || video.statistics?.viewCount === undefined) continue;
    uniqueVideos.set(video.id, video);
  }
  return [...uniqueVideos.values()]
    .sort((a, b) => (b.statistics?.viewCount ?? 0) - (a.statistics?.viewCount ?? 0))
    .slice(0, MOST_VIEWED_VIDEO_LIMIT);
}

/**
 * One bounded REST read of a whole collection. Returns an empty array rather
 * than throwing so a quota-exhausted or unconfigured project degrades to an
 * empty public catalog instead of a 500 error page.
 *
 * `cache: "no-store"` is deliberate: the 24-hour caching is owned entirely by
 * `use cache` + `cacheLife` below, so there is exactly one cache in play.
 */
async function readCollection<T>(collectionId: string, maxRows = MAX_FEED_ROWS, orderBy?: string): Promise<T[]> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return [];
  const ordering = orderBy ? `&orderBy=${encodeURIComponent(orderBy)}` : "";
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collectionId)}?pageSize=${maxRows}${ordering}&key=${encodeURIComponent(apiKey)}`;
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
    if (!response.ok) return [];
    const body = await response.json() as { documents?: RestDocument[] };
    return (body.documents ?? []).flatMap((document) => {
      const id = documentId(document.name);
      if (!id || !document.fields) return [];
      return [{ id, ...decodeFields(document.fields) } as T];
    });
  } catch {
    return [];
  }
}

/**
 * The public catalog snapshot. The `use cache` directive plus the `catalogFeed`
 * profile in next.config.ts hold one snapshot for 24 hours and share it across
 * every visitor, so a full day of traffic costs one bounded read of each
 * collection instead of one read per page view.
 */
export async function getPublicCatalog(): Promise<PublicCatalogFeed> {
  "use cache";
  cacheLife("catalogFeed");
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return EMPTY_CATALOG_FEED;
  const channels = await readCollection<FeedChannel>("channels");
  const enabledChannelIds = channels.filter((channel) => channel.enabled !== false).map((channel) => channel.id);
  const [videos, mostViewedVideos, playlists, meetings] = await Promise.all([
    readCollection<FeedVideo>("videos", MAX_VIDEO_FEED_ROWS, "publishedAt desc"),
    readMostViewedVideos(enabledChannelIds),
    readCollection<FeedPlaylist>("playlists"),
    readCollection<FeedMeeting>("meetings"),
  ]);
  const total = channels.length + videos.length + playlists.length + meetings.length;
  return {
    channels: channels.filter((channel) => channel.enabled !== false),
    videos: videos.filter((video) => video.availability !== "unavailable" && video.website?.hidden !== true),
    mostViewedVideos,
    playlists,
    meetings,
    fetchedAt: new Date().toISOString(),
    truncated: channels.length >= MAX_FEED_ROWS || videos.length >= MAX_VIDEO_FEED_ROWS || playlists.length >= MAX_FEED_ROWS || meetings.length >= MAX_FEED_ROWS || total >= MAX_FEED_ROWS,
  };
}
