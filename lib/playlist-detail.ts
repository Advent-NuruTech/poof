import { cacheLife, cacheTag } from "next/cache";

import type { FeedVideo } from "@/lib/catalog-feed-types";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/catalog-feed-types";
import { isD1Configured, queryD1 } from "@/lib/cloudflare-d1";

type VideoRow = { data_json: string };

/**
 * Playlist pages need more than the bounded, newest-video catalog feed. This
 * lookup reads only videos that belong to one playlist and shares the result
 * with the same tagged cache as the rest of the public catalog.
 */
export async function getPublicPlaylistVideos(playlistId: string): Promise<FeedVideo[]> {
  "use cache: remote";
  cacheLife("catalogFeed");
  cacheTag(PUBLIC_CATALOG_CACHE_TAG);

  if (!isD1Configured()) return [];

  try {
    const rows = await queryD1<VideoRow>(
      "SELECT data_json FROM videos WHERE availability = 'available' AND hidden = 0 AND EXISTS (SELECT 1 FROM json_each(videos.data_json, '$.playlistIds') WHERE value = ?) LIMIT 300",
      [playlistId],
    );
    return rows.flatMap((row) => {
      try {
        const video = JSON.parse(row.data_json) as FeedVideo;
        return video.playlistIds?.includes(playlistId) ? [video] : [];
      } catch {
        return [];
      }
    });
  } catch (error) {
    console.error(`Could not load public videos for playlist ${playlistId}.`, error);
    return [];
  }
}
