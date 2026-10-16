CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY NOT NULL,
  data_json TEXT NOT NULL,
  video_url TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT '',
  channel_id TEXT NOT NULL DEFAULT '',
  catalog_channel_ids_json TEXT NOT NULL DEFAULT '[]',
  view_count INTEGER NOT NULL DEFAULT 0,
  availability TEXT NOT NULL DEFAULT 'available',
  hidden INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS videos_published_at_idx ON videos(published_at DESC);
CREATE INDEX IF NOT EXISTS videos_channel_id_idx ON videos(channel_id);
CREATE INDEX IF NOT EXISTS videos_view_count_idx ON videos(view_count DESC);
