import { NextResponse } from "next/server";
import { getPublicCatalog } from "@/lib/catalog-feed";
import { FEED_CACHE_CONTROL } from "@/lib/catalog-feed-types";

// The catalog is served from the cached server snapshot, never from Firestore
// per visitor: the `use cache` + `catalogFeed` pair inside getPublicCatalog()
// revalidates every 24 hours (FEED_CACHE_SECONDS) and the response is marked
// shared-cacheable for the same window. Anonymous traffic therefore shares one
// snapshot and does not consume the Firestore free tier. See lib/catalog-feed.ts
// for the full quota rules.
export async function GET() {
  const feed = await getPublicCatalog();
  return NextResponse.json(feed, { headers: { "Cache-Control": FEED_CACHE_CONTROL } });
}
