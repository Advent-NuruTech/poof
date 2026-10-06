"use client";

import { useEffect, useState } from "react";
import type { Channel, Playlist, Video } from "@/lib/catalog";
import type { Meeting } from "@/lib/meetings";
import type { FeedChannel, FeedMeeting, FeedPlaylist, FeedVideo, PublicCatalogFeed } from "@/lib/catalog-feed-types";

// Client access to the server-cached public catalog.
//
// Quota rules this hook exists to enforce:
//  - No `onSnapshot` listeners on public pages. A live listener re-delivers the
//    whole catalog to every visitor on every sync write, which is what exhausted
//    the Firestore free tier. This hook fetches once per page view and the
//    server cache (24 hours) means those fetches almost never reach Firestore.
//  - `refreshCatalogFeed()` deliberately does NOT force a server refresh. It
//    re-reads the current cached snapshot so it cannot be used (or abused) to
//    generate uncached Firestore reads. The server snapshot refreshes itself
//    every 24 hours when Next.js revalidates.

export type CatalogStatus = "loading" | "ready" | "error";

const FEED_URL = "/api/catalog";

/**
 * Reads the catalog snapshot from the server cache.
 *
 * This is the ONLY way a public page may reach Firestore-backed catalog data.
 * It hits /api/catalog, which is served from a snapshot cached for 24 hours
 * (FEED_CACHE_SECONDS), so calling it repeatedly does not increase Firestore
 * reads. It must never be changed to read Firestore from the browser.
 */
export async function fetchCatalogFeed(): Promise<PublicCatalogFeed | null> {
  try {
    const response = await fetch(FEED_URL, { cache: "no-store" });
    return response.ok ? await response.json() as PublicCatalogFeed : null;
  } catch {
    return null;
  }
}

const EMPTY_FEED: PublicCatalogFeed = { channels: [], videos: [], playlists: [], meetings: [], fetchedAt: "", truncated: false };

export function usePublicCatalog() {
  const [feed, setFeed] = useState<PublicCatalogFeed>(EMPTY_FEED);
  const [status, setStatus] = useState<CatalogStatus>("loading");

  useEffect(() => {
    let active = true;
    void fetchCatalogFeed().then((body) => {
      if (!active) return;
      setFeed(body ?? EMPTY_FEED);
      setStatus(body ? "ready" : "error");
    });
    return () => { active = false; };
  }, []);

  return { feed, status };
}

/**
 * Re-reads the cached snapshot for callers that already hold a feed in state
 * (the homepage's "view all" and the playlist "load more"). Never forces an
 * uncached Firestore read — it re-reads the same 24-hour server snapshot.
 */
export const refreshCatalogFeed = fetchCatalogFeed;

/* The cached feed stores only the fields public pages render. These adapters
   fill the required fields of the existing catalog types so components keep
   their current shape without any Firestore access of their own. */
const asVideo = (video: FeedVideo): Video => ({ ...video, thumbnail: video.thumbnail ?? "", publishedAt: video.publishedAt ?? "", channelId: video.channelId ?? "", channelTitle: video.channelTitle ?? "" });
const asPlaylist = (playlist: FeedPlaylist): Playlist => ({ ...playlist, thumbnail: playlist.thumbnail ?? "", channelId: playlist.channelId ?? "", channelTitle: playlist.channelTitle ?? "", videoIds: playlist.videoIds ?? [], itemCount: playlist.itemCount ?? 0 });
const asChannel = (channel: FeedChannel): Channel => ({ ...channel, enabled: channel.enabled !== false });
const asMeeting = (meeting: FeedMeeting): Meeting => meeting;

export function feedVideos(feed: PublicCatalogFeed): Video[] { return feed.videos.map(asVideo); }
export function feedPlaylists(feed: PublicCatalogFeed): Playlist[] { return feed.playlists.map(asPlaylist); }
export function feedChannels(feed: PublicCatalogFeed): Channel[] { return feed.channels.map(asChannel); }
export function feedMeetings(feed: PublicCatalogFeed): Meeting[] { return feed.meetings.map(asMeeting); }
