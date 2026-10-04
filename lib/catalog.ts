export type Video = {
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
  channelPlaylistIds?: Record<string, string[]>;
  availability?: "available" | "unavailable";
  embeddable?: boolean;
  statistics?: { viewCount?: number; likeCount?: number; commentCount?: number };
  website?: { hidden?: boolean; featured?: boolean; displayTitle?: string; category?: string };
};

export type Playlist = {
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

export type Channel = {
  id: string;
  title: string;
  description?: string;
  thumbnail: string;
  customUrl?: string;
  uploadsPlaylistId?: string;
  enabled: boolean;
  lastSyncedAt?: unknown;
  syncStatus?: string;
  lastSyncError?: string;
  lastSyncNewVideoCount?: number;
};

export function formatDuration(duration?: string) {
  if (!duration) return "";
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatDate(value?: string) {
  if (!value) return "Recently added";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
