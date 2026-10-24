import type { Video } from "@/lib/catalog";
import { queryD1 } from "@/lib/cloudflare-d1";

type StoredVideoRow = { data_json: string };
type StoredVideo = Video & { lastSyncedAt?: string };
type FirestoreValue = Record<string, unknown>;
type FirestoreDocument = { name?: string; fields?: Record<string, FirestoreValue> };

function firestoreValue(value: FirestoreValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return ((value.arrayValue as { values?: FirestoreValue[] } | undefined)?.values ?? []).map(firestoreValue);
  if ("mapValue" in value) return firestoreFields((value.mapValue as { fields?: Record<string, FirestoreValue> } | undefined)?.fields ?? {});
  return undefined;
}

function firestoreFields(fields: Record<string, FirestoreValue>) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, firestoreValue(value)]));
}

function decodeRows(rows: StoredVideoRow[]) {
  return rows.flatMap((row) => { try { return [JSON.parse(row.data_json) as Video]; } catch { return []; } });
}

async function legacyVideos(channelId: string, idToken: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) throw new Error("Firebase is not configured to migrate the existing video catalog.");
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: "videos" }],
      where: { fieldFilter: { field: { fieldPath: "catalogChannelIds" }, op: "ARRAY_CONTAINS", value: { stringValue: channelId } } },
    } }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Could not preserve the existing video settings (Firestore returned ${response.status}).`);
  const rows = await response.json() as Array<{ document?: FirestoreDocument }>;
  return rows.flatMap(({ document }) => {
    const id = document?.name?.split("/").pop();
    return id && document?.fields ? [{ ...firestoreFields(document.fields), id } as Video] : [];
  });
}

async function saveBatch(videos: Video[]) {
  const updatedAt = new Date().toISOString();
  const rows = videos.map((video) => ({
    id: video.id,
    data_json: JSON.stringify(video),
    video_url: video.videoUrl ?? `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`,
    published_at: video.publishedAt ?? "",
    channel_id: video.channelId ?? "",
    catalog_channel_ids_json: JSON.stringify(video.catalogChannelIds ?? []),
    view_count: video.statistics?.viewCount ?? 0,
    availability: video.availability ?? "available",
    hidden: video.website?.hidden === true ? 1 : 0,
    updated_at: updatedAt,
  }));
  for (let offset = 0; offset < rows.length; offset += 100) {
    await queryD1(
      "INSERT INTO videos (id, data_json, video_url, published_at, channel_id, catalog_channel_ids_json, view_count, availability, hidden, updated_at) SELECT json_extract(value, '$.id'), json_extract(value, '$.data_json'), json_extract(value, '$.video_url'), json_extract(value, '$.published_at'), json_extract(value, '$.channel_id'), json_extract(value, '$.catalog_channel_ids_json'), json_extract(value, '$.view_count'), json_extract(value, '$.availability'), json_extract(value, '$.hidden'), json_extract(value, '$.updated_at') FROM json_each(?) WHERE 1 ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, video_url = excluded.video_url, published_at = excluded.published_at, channel_id = excluded.channel_id, catalog_channel_ids_json = excluded.catalog_channel_ids_json, view_count = excluded.view_count, availability = excluded.availability, hidden = excluded.hidden, updated_at = excluded.updated_at",
      [JSON.stringify(rows.slice(offset, offset + 100))],
    );
  }
}

/** Delete records rather than retaining unavailable YouTube placeholders in D1. */
async function deleteBatch(ids: Iterable<string>) {
  const uniqueIds = [...new Set(ids)];
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    const batch = uniqueIds.slice(offset, offset + 100);
    await queryD1(`DELETE FROM videos WHERE id IN (${batch.map(() => "?").join(",")})`, batch);
  }
}

/** Move a channel's synchronized video records to D1, preserving Firestore editorial fields on first sync. */
export async function syncVideoRecords(channelId: string, videos: Video[], unavailableIds: string[], idToken: string) {
  const priorRows = decodeRows(await queryD1<StoredVideoRow>(
    "SELECT data_json FROM videos WHERE EXISTS (SELECT 1 FROM json_each(videos.catalog_channel_ids_json) WHERE value = ?)",
    [channelId],
  ));
  const firstSync = priorRows.length === 0;
  const legacy = firstSync ? await legacyVideos(channelId, idToken) : [];
  const existingIds = [...new Set(videos.map((video) => video.id))];
  const otherRows: Video[] = [];
  for (let offset = 0; offset < existingIds.length; offset += 80) {
    const ids = existingIds.slice(offset, offset + 80);
    if (ids.length) otherRows.push(...decodeRows(await queryD1<StoredVideoRow>(`SELECT data_json FROM videos WHERE id IN (${ids.map(() => "?").join(",")})`, ids)));
  }
  const previousById = new Map<string, Video>();
  for (const video of [...legacy, ...priorRows, ...otherRows]) previousById.set(video.id, { ...previousById.get(video.id), ...video });
  const previousIds = new Set(previousById.keys());
  const currentIds = new Set(videos.map((video) => video.id));
  const deletedIds = new Set(unavailableIds);
  const nextVideos: StoredVideo[] = videos.map((video) => {
    const previous = previousById.get(video.id);
    const channelPlaylistIds = { ...(previous?.channelPlaylistIds ?? {}), [channelId]: video.playlistIds ?? [] };
    return {
      ...previous,
      ...video,
      playlistIds: [...new Set(Object.values(channelPlaylistIds).flat())],
      channelPlaylistIds,
      catalogChannelIds: [...new Set([...(previous?.catalogChannelIds ?? []), channelId])],
      availability: "available" as const,
      website: previous?.website ?? video.website,
      lastSyncedAt: new Date().toISOString(),
    };
  });
  for (const previous of priorRows) {
    if (currentIds.has(previous.id) || unavailableIds.includes(previous.id)) continue;
    const catalogChannelIds = (previous.catalogChannelIds ?? []).filter((id) => id !== channelId);
    const channelPlaylistIds = { ...(previous.channelPlaylistIds ?? {}) };
    delete channelPlaylistIds[channelId];
    if (catalogChannelIds.length) {
      nextVideos.push({
        ...previous,
        catalogChannelIds,
        channelPlaylistIds,
        playlistIds: [...new Set(Object.values(channelPlaylistIds).flat())],
        availability: "available",
        lastSyncedAt: new Date().toISOString(),
      });
    } else {
      // The video no longer appears in this channel's uploads or playlists,
      // and no other connected channel references it. Remove it outright.
      deletedIds.add(previous.id);
    }
  }
  await saveBatch(nextVideos);
  await deleteBatch(deletedIds);
  // Clear records left by older syncs, which stored unavailable videos as
  // placeholders instead of deleting them.
  await queryD1("DELETE FROM videos WHERE availability = 'unavailable' OR json_array_length(catalog_channel_ids_json) = 0");
  return { newVideoCount: videos.filter((video) => !previousIds.has(video.id)).length, videoCount: videos.length, deletedVideoCount: deletedIds.size, migratedLegacyRecords: legacy.length };
}
