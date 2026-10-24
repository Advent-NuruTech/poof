import { NextResponse } from "next/server";

import { getPublicPlaylistVideos } from "@/lib/playlist-detail";

export async function GET(request: Request) {
  const playlistId = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(playlistId)) {
    return NextResponse.json({ error: "A valid playlist ID is required." }, { status: 400 });
  }

  const videos = await getPublicPlaylistVideos(playlistId);
  return NextResponse.json({ videos }, { headers: { "Cache-Control": "no-store" } });
}
