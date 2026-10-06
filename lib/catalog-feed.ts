import { cacheLife } from "next/cache";

import type { FeedChannel, FeedMeeting, FeedPlaylist, FeedVideo, PublicCatalogFeed } from "@/lib/catalog-feed-types";
import { EMPTY_CATALOG_FEED } from "@/lib/catalog-feed-types";

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
 *  - Reads are one-shot and bounded by MAX_FEED_ROWS per collection.
 */

export type { FeedChannel, FeedMeeting, FeedPlaylist, FeedVideo, PublicCatalogFeed } from "@/lib/catalog-feed-types";
export { EMPTY_CATALOG_FEED, FEED_CACHE_CONTROL, FEED_CACHE_MS, FEED_CACHE_SECONDS } from "@/lib/catalog-feed-types";

/** Hard ceiling on documents pulled per collection, regardless of catalog size. */
export const MAX_FEED_ROWS = 900;

const FEED_TIMEOUT_MS = 8000;

type RestDocument = { name?: string; fields?: Record<string, unknown> };

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

/**
 * One bounded REST read of a whole collection. Returns an empty array rather
 * than throwing so a quota-exhausted or unconfigured project degrades to an
 * empty public catalog instead of a 500 error page.
 *
 * `cache: "no-store"` is deliberate: the 24-hour caching is owned entirely by
 * `use cache` + `cacheLife` below, so there is exactly one cache in play.
 */
async function readCollection<T>(collectionId: string): Promise<T[]> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return [];
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collectionId)}?pageSize=${MAX_FEED_ROWS}&key=${encodeURIComponent(apiKey)}`;
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
  const [channels, videos, playlists, meetings] = await Promise.all([
    readCollection<FeedChannel>("channels"),
    readCollection<FeedVideo>("videos"),
    readCollection<FeedPlaylist>("playlists"),
    readCollection<FeedMeeting>("meetings"),
  ]);
  const total = channels.length + videos.length + playlists.length + meetings.length;
  return {
    channels: channels.filter((channel) => channel.enabled !== false),
    videos: videos.filter((video) => video.availability !== "unavailable" && video.website?.hidden !== true),
    playlists,
    meetings,
    fetchedAt: new Date().toISOString(),
    truncated: channels.length >= MAX_FEED_ROWS || videos.length >= MAX_FEED_ROWS || playlists.length >= MAX_FEED_ROWS || meetings.length >= MAX_FEED_ROWS || total >= MAX_FEED_ROWS,
  };
}
