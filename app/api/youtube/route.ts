import type { Channel, Playlist, Video } from "@/lib/catalog";

const apiKey = process.env.YOUTUBE_DATA_API_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const youtubeBase = "https://www.googleapis.com/youtube/v3";

type YoutubePage<T> = { items?: T[]; nextPageToken?: string };
type YoutubeChannel = { id: string; snippet?: { title?: string; description?: string; customUrl?: string; thumbnails?: Record<string, { url?: string }> }; contentDetails?: { relatedPlaylists?: { uploads?: string } } };
type YoutubePlaylist = { id: string; snippet?: { title?: string; description?: string; channelId?: string; channelTitle?: string; thumbnails?: Record<string, { url?: string }> }; contentDetails?: { itemCount?: number } };
type YoutubePlaylistItem = { snippet?: { title?: string; description?: string; channelId?: string; channelTitle?: string; publishedAt?: string; position?: number; resourceId?: { videoId?: string }; thumbnails?: Record<string, { url?: string }> }; contentDetails?: { videoId?: string } };
type YoutubeVideo = { id: string; snippet?: { title?: string; description?: string; channelId?: string; channelTitle?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string }> }; contentDetails?: { duration?: string }; liveStreamingDetails?: { actualStartTime?: string; actualEndTime?: string; scheduledStartTime?: string }; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }; status?: { privacyStatus?: string; embeddable?: boolean } };

function image(thumbnails?: Record<string, { url?: string }>) {
  return thumbnails?.maxres?.url ?? thumbnails?.standard?.url ?? thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url ?? "/images/logo.jpeg";
}

async function yt<T>(resource: string, params: Record<string, string>) {
  if (!apiKey) throw new Error("YOUTUBE_DATA_API_KEY is not configured on the server.");
  const url = new URL(`${youtubeBase}/${resource}`);
  for (const [key, value] of Object.entries({ ...params, key: apiKey })) url.searchParams.set(key, value);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, { cache: "no-store" });
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      continue;
    }
    const body = await response.json();
    if (response.ok) return body as T;
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      continue;
    }
    throw new Error(body?.error?.message ?? `YouTube API request failed (${response.status}).`);
  }
  throw new Error("YouTube API request failed after retries.");
}

async function authorize(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !firebaseApiKey || !projectId) return null;
  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }), cache: "no-store",
  });
  if (!lookup.ok) return null;
  const identity = await lookup.json() as { users?: Array<{ localId?: string }> };
  const uid = identity.users?.[0]?.localId;
  if (!uid) return null;
  const admin = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!admin.ok) return null;
  const record = await admin.json() as { fields?: { enabled?: { booleanValue?: boolean } } };
  return record.fields?.enabled?.booleanValue === true ? uid : null;
}

async function allPages<T>(resource: string, params: Record<string, string>) {
  const rows: T[] = [];
  let pageToken = "";
  do {
    const page = await yt<YoutubePage<T>>(resource, { ...params, ...(pageToken ? { pageToken } : {}) });
    rows.push(...(page.items ?? []));
    pageToken = page.nextPageToken ?? "";
  } while (pageToken && rows.length < 2500);
  return rows;
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, map: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  for (let start = 0; start < items.length; start += concurrency) {
    const batch = items.slice(start, start + concurrency);
    const mapped = await Promise.all(batch.map(map));
    results.splice(start, mapped.length, ...mapped);
  }
  return results;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    if (action === "lookup") {
      if (!await authorize(request)) return Response.json({ error: "Sign in with an authorized administrator account to add channels." }, { status: 403 });
      const input = url.searchParams.get("query")?.trim();
      if (!input) return Response.json({ error: "Enter a YouTube channel URL, handle, or channel ID." }, { status: 400 });
      const id = input.match(/(?:channel\/|youtube\.com\/channel\/)(UC[\w-]{20,})/i)?.[1] ?? (/^UC[\w-]{20,}$/.test(input) ? input : "");
      const handle = input.match(/youtube\.com\/@([\w.-]+)/i)?.[1] ?? (input.startsWith("@") ? input.slice(1) : "");
      const legacyUsername = input.match(/youtube\.com\/user\/([^/?]+)/i)?.[1] ?? "";
      const customSlug = input.match(/youtube\.com\/c\/([^/?]+)/i)?.[1] ?? "";
      let response: { items?: YoutubeChannel[] };
      if (id) response = await yt<{ items?: YoutubeChannel[] }>("channels", { part: "snippet,contentDetails", id });
      else if (handle) response = await yt<{ items?: YoutubeChannel[] }>("channels", { part: "snippet,contentDetails", forHandle: handle });
      else if (legacyUsername) response = await yt<{ items?: YoutubeChannel[] }>("channels", { part: "snippet,contentDetails", forUsername: legacyUsername });
      else if (customSlug) {
        const searchResult = await yt<{ items?: Array<{ id?: { channelId?: string } }> }>("search", { part: "snippet", type: "channel", maxResults: "1", q: customSlug });
        const channelId = searchResult.items?.[0]?.id?.channelId;
        response = channelId ? await yt<{ items?: YoutubeChannel[] }>("channels", { part: "snippet,contentDetails", id: channelId }) : {};
      } else if (!input.includes("/") && input.length < 120) {
        response = await yt<{ items?: YoutubeChannel[] }>("channels", { part: "snippet,contentDetails", forHandle: input.replace(/^@/, "") });
        if (!response.items?.length) response = await yt<{ items?: YoutubeChannel[] }>("channels", { part: "snippet,contentDetails", forUsername: input });
      } else return Response.json({ error: "Use a YouTube channel URL, @handle, or UC channel ID." }, { status: 400 });
      const channel = response.items?.[0];
      if (!channel) return Response.json({ error: "We couldn't find that YouTube channel." }, { status: 404 });
      const counts = await Promise.all([
        yt<{ pageInfo?: { totalResults?: number } }>("playlists", { part: "id", channelId: channel.id, maxResults: "1" }),
        yt<{ pageInfo?: { totalResults?: number } }>("playlistItems", { part: "id", playlistId: channel.contentDetails?.relatedPlaylists?.uploads ?? "", maxResults: "1" }),
      ]);
      return Response.json({ channel: {
        id: channel.id, title: channel.snippet?.title ?? "YouTube Channel", description: channel.snippet?.description ?? "",
        thumbnail: image(channel.snippet?.thumbnails), customUrl: channel.snippet?.customUrl ?? "",
        uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads ?? "",
        playlistCount: counts[0].pageInfo?.totalResults ?? 0, videoCount: counts[1].pageInfo?.totalResults ?? 0,
      } });
    }
    if (action !== "sync") return Response.json({ error: "Choose a supported action." }, { status: 400 });
    const uid = await authorize(request);
    if (!uid || !firebaseApiKey || !projectId) return Response.json({ error: "Administrator access is required to sync channels." }, { status: 403 });
    const channelId = url.searchParams.get("channelId") ?? "";
    if (!/^UC[\w-]{20,}$/.test(channelId)) return Response.json({ error: "A valid channel ID is required." }, { status: 400 });
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const leaseResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/syncLeases/${encodeURIComponent(channelId)}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (!leaseResponse.ok) return Response.json({ error: "Acquire the channel sync lease before starting a sync." }, { status: 409 });
    const lease = await leaseResponse.json() as { fields?: { owner?: { stringValue?: string }; expiresAt?: { timestampValue?: string } } };
    if (lease.fields?.owner?.stringValue !== uid || Date.parse(lease.fields.expiresAt?.timestampValue ?? "") <= Date.now()) {
      return Response.json({ error: "The channel sync lease is missing or expired." }, { status: 409 });
    }

    const [channelResponse, playlistRows] = await Promise.all([
      yt<{ items?: YoutubeChannel[] }>("channels", { part: "snippet,contentDetails", id: channelId }),
      allPages<YoutubePlaylist>("playlists", { part: "snippet,contentDetails", channelId, maxResults: "50" }),
    ]);
    const channelRow = channelResponse.items?.[0];
    if (!channelRow) return Response.json({ error: "YouTube channel no longer exists or is unavailable." }, { status: 404 });
    const uploadsId = channelRow.contentDetails?.relatedPlaylists?.uploads ?? "";
    const uploads = uploadsId ? await allPages<YoutubePlaylistItem>("playlistItems", { part: "snippet,contentDetails", playlistId: uploadsId, maxResults: "50" }) : [];
    const playlistResults = await mapConcurrent(playlistRows, 5, async (row) => {
      const items = await allPages<YoutubePlaylistItem>("playlistItems", { part: "snippet,contentDetails", playlistId: row.id, maxResults: "50" });
      const videoIds = items
        .sort((a, b) => (a.snippet?.position ?? 0) - (b.snippet?.position ?? 0))
        .map((item) => item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId ?? "")
        .filter(Boolean);
      const playlist: Playlist = {
        id: row.id, title: row.snippet?.title ?? "Untitled playlist", description: row.snippet?.description ?? "",
        thumbnail: image(row.snippet?.thumbnails), channelId, channelTitle: row.snippet?.channelTitle ?? channelRow.snippet?.title ?? "",
        videoIds, itemCount: videoIds.length,
      };
      return playlist;
    });
    const ids = [...new Set([
      ...uploads.map((item) => item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId ?? ""),
      ...playlistResults.flatMap((playlist) => playlist.videoIds),
    ].filter(Boolean))];
    const details: YoutubeVideo[] = [];
    for (let offset = 0; offset < ids.length; offset += 50) {
      const batch = ids.slice(offset, offset + 50);
      const result = await yt<{ items?: YoutubeVideo[] }>("videos", { part: "snippet,contentDetails,liveStreamingDetails,statistics,status", id: batch.join(",") });
      details.push(...(result.items ?? []));
    }
    const playlistByVideo = new Map<string, string[]>();
    for (const playlist of playlistResults) for (const videoId of playlist.videoIds) playlistByVideo.set(videoId, [...(playlistByVideo.get(videoId) ?? []), playlist.id]);
    const videos: Video[] = details.filter((video) => video.status?.privacyStatus !== "private").map((video) => ({
      id: video.id, title: video.snippet?.title ?? "Untitled video", description: video.snippet?.description ?? "",
      thumbnail: image(video.snippet?.thumbnails), publishedAt: video.snippet?.publishedAt ?? "", channelId: video.snippet?.channelId ?? channelId,
      channelTitle: video.snippet?.channelTitle ?? channelRow.snippet?.title ?? "", duration: video.contentDetails?.duration ?? "",
      liveStatus: video.liveStreamingDetails?.actualEndTime ? "complete" : video.liveStreamingDetails?.actualStartTime ? "live" : video.liveStreamingDetails?.scheduledStartTime ? "upcoming" : "",
      embeddable: video.status?.embeddable ?? true,
      statistics: {
        ...(video.statistics?.viewCount ? { viewCount: Number(video.statistics.viewCount) } : {}),
        ...(video.statistics?.likeCount ? { likeCount: Number(video.statistics.likeCount) } : {}),
        ...(video.statistics?.commentCount ? { commentCount: Number(video.statistics.commentCount) } : {}),
      },
      playlistIds: playlistByVideo.get(video.id) ?? [],
    }));
    const availableIds = new Set(videos.map((video) => video.id));
    const unavailableVideoIds = ids.filter((id) => !availableIds.has(id));
    const channel: Channel = {
      id: channelId, title: channelRow.snippet?.title ?? "YouTube Channel", description: channelRow.snippet?.description ?? "",
      thumbnail: image(channelRow.snippet?.thumbnails), customUrl: channelRow.snippet?.customUrl,
      uploadsPlaylistId: uploadsId, enabled: true, syncStatus: "complete",
    };
    return Response.json({ channel, playlists: playlistResults, videos, unavailableVideoIds, syncedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "YouTube synchronization failed." }, { status: 502 });
  }
}
