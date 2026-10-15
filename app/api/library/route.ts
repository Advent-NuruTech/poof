import { NextResponse } from "next/server";
import { getPublicLibrary } from "@/lib/library-feed";

export async function GET(request: Request) {
  // Keep only the Firestore-backed data cached so an admin invalidation is
  // visible immediately; do not layer an independent HTTP cache on top.
  void request.url;
  const library = await getPublicLibrary();
  return NextResponse.json(library, {
    headers: { "Cache-Control": "no-store" },
  });
}
