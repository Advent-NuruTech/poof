import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/catalog-feed-types";
import { isD1Configured, queryD1 } from "@/lib/cloudflare-d1";
import { getMailDb } from "@/lib/mailing-server";
import type { Video } from "@/lib/catalog";

export const maxDuration = 300;

type YouTubeVideo = {
  id: string;
  snippet?: { title?: string; description?: string; publishedAt?: string; channelId?: string; channelTitle?: string; thumbnails?: Record<string, { url?: string }> };
  contentDetails?: { duration?: string };
  liveStreamingDetails?: { actualEndTime?: string; actualStartTime?: string; scheduledStartTime?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  status?: { privacyStatus?: string; embeddable?: boolean };
};

async function youtube<T>(resource: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  for (const [key, value] of Object.entries({ ...params, key: process.env.YOUTUBE_DATA_API_KEY ?? "" })) url.searchParams.set(key, value);
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`YouTube ${resource} returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!secret || !supplied || !timingSafeEqual(createHash("sha256").update(secret).digest(), createHash("sha256").update(supplied).digest())) {
    return Response.json({ error: "Not authorized." }, { status: 401 });
  }
  if (!isD1Configured() || !process.env.YOUTUBE_DATA_API_KEY) return Response.json({ error: "YouTube or D1 is not configured." }, { status: 503 });

  let inserted = 0;
  let failures = 0;
  try {
    const channels = await getMailDb().collection("channels").get();
    for (const doc of channels.docs) {
      const channel = doc.data();
      if (channel.enabled === false || !channel.uploadsPlaylistId) continue;
      try {
        const page = await youtube<{ items?: Array<{ contentDetails?: { videoId?: string } }> }>("playlistItems", {
          part: "contentDetails", playlistId: channel.uploadsPlaylistId, maxResults: "50",
        });
        const ids = [...new Set((page.items ?? []).map((item) => item.contentDetails?.videoId).filter((id): id is string => Boolean(id)))];
        if (!ids.length) continue;
        const existing = await queryD1<{ id: string }>(`SELECT id FROM videos WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
        const known = new Set(existing.map((row) => row.id));
        const missing = ids.filter((id) => !known.has(id));
        if (!missing.length) continue;
        const details = await youtube<{ items?: YouTubeVideo[] }>("videos", { part: "snippet,contentDetails,liveStreamingDetails,statistics,status", id: missing.join(",") });
        for (const item of details.items ?? []) {
          if (item.status?.privacyStatus !== "public" || item.snippet?.channelId !== doc.id) continue;
          const thumbnails = item.snippet?.thumbnails;
          const video: Video = {
            id: item.id, videoUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(item.id)}`,
            title: item.snippet?.title ?? "Untitled video", description: item.snippet?.description ?? "",
            thumbnail: thumbnails?.maxres?.url ?? thumbnails?.standard?.url ?? thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url ?? "",
            publishedAt: item.snippet?.publishedAt ?? "", channelId: doc.id, channelTitle: item.snippet?.channelTitle ?? channel.title ?? "",
            duration: item.contentDetails?.duration ?? "",
            liveStatus: item.liveStreamingDetails?.actualEndTime ? "complete" : item.liveStreamingDetails?.actualStartTime ? "live" : item.liveStreamingDetails?.scheduledStartTime ? "upcoming" : "",
            embeddable: item.status?.embeddable ?? true,
            statistics: {
              ...(item.statistics?.viewCount ? { viewCount: Number(item.statistics.viewCount) } : {}),
              ...(item.statistics?.likeCount ? { likeCount: Number(item.statistics.likeCount) } : {}),
              ...(item.statistics?.commentCount ? { commentCount: Number(item.statistics.commentCount) } : {}),
            },
            playlistIds: [], channelPlaylistIds: { [doc.id]: [] }, catalogChannelIds: [doc.id], availability: "available",
          };
          const result = await queryD1<{ id: string }>("INSERT INTO videos (id, data_json, video_url, published_at, channel_id, catalog_channel_ids_json, view_count, availability, hidden, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'available', 0, ?) ON CONFLICT(id) DO NOTHING RETURNING id", [video.id, JSON.stringify(video), video.videoUrl!, video.publishedAt, doc.id, JSON.stringify([doc.id]), video.statistics?.viewCount ?? 0, new Date().toISOString()]);
          inserted += result.length;
        }
      } catch (error) {
        failures++;
        console.error(`Recent YouTube check failed for ${doc.id}.`, error);
      }
    }
    return Response.json({ inserted, failures }, { status: failures ? 502 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Recent YouTube check failed.", error);
    return Response.json({ error: "Recent YouTube check failed.", inserted, failures }, { status: 502 });
  } finally {
    if (inserted) revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
  }
}
