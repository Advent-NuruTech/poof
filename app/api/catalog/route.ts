import { NextResponse } from "next/server";
import { getPublicCatalog } from "@/lib/catalog-feed";

// The catalog is served from the cached server snapshot, never from Firestore
// per visitor: the `use cache` + `catalogFeed` pair inside getPublicCatalog()
// shares one snapshot across visitors. The response itself must not be cached
// separately, so an administrator's on-demand cache invalidation is visible on
// the next request. See lib/catalog-feed.ts for the full quota rules.
export async function GET(request: Request) {
  // Keep the HTTP response request-time; only the catalog data is shared-cached.
  void request.url;
  const feed = await getPublicCatalog();
  return NextResponse.json(feed, { headers: { "Cache-Control": "no-store" } });
}
