import { NextResponse } from "next/server";

// Firestore's aggregation `count` endpoint bills one document read per query
// regardless of collection size, so this is the cheapest way to learn whether a
// single read of the whole catalog would fit in a budget. Used by the quota
// diagnostics; not part of any page render.
// Route segment config (`runtime`, `dynamic`, `revalidate`) is not allowed while
// `nextConfig.cacheComponents` is enabled, so this stays uncached by default.

const COLLECTIONS = ["channels", "videos", "playlists", "meetings", "libraryCategories", "libraryDocuments", "contacts"] as const;
const TIMEOUT_MS = 8000;

async function countCollection(collectionId: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return { count: 0, denied: true };
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runAggregationQuery?key=${encodeURIComponent(apiKey)}`;
  const body = {
    structuredAggregationQuery: {
      structuredQuery: { from: [{ collectionId }], limit: 1 },
      aggregations: [{ alias: "total", count: {} }],
    },
  };
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return { count: 0, denied: true };
    const result = await response.json() as Array<{ result?: { aggregateFields?: { total?: { integerValue?: string } } } }>;
    return { count: Number(result?.[0]?.result?.aggregateFields?.total?.integerValue ?? 0), denied: false };
  } catch {
    return { count: 0, denied: true };
  }
}

export async function GET() {
  const counts = await Promise.all(COLLECTIONS.map(async (collectionId) => [collectionId, await countCollection(collectionId)] as const));
  const inventory = Object.fromEntries(counts.map(([id, value]) => [id, value.count])) as Record<(typeof COLLECTIONS)[number], number>;
  const measurable = counts.filter(([, value]) => !value.denied);
  const deniable = new Set<string>(["contacts"]);
  const catalogRows = measurable.filter(([id]) => !deniable.has(id)).reduce((total, [, value]) => total + value.count, 0);
  const fullCatalogReadFitsBudget = measurable.length === COLLECTIONS.length && catalogRows + COLLECTIONS.length < 50000;
  return NextResponse.json({
    inventory,
    catalogRows,
    fullCatalogReadFitsBudget,
    guidance: fullCatalogReadFitsBudget
      ? "A single read of every catalog collection plus the inventory counts stays inside the free daily read allowance. Keep the 24-hour public feed cache in place."
      : "The catalog is too large to re-read on every visitor request. Keep every public read on the cached feed (lib/catalog-feed.ts) and never add public onSnapshot listeners.",
  });
}
