import type { NextConfig } from "next";

import { FEED_CACHE_SECONDS } from "./lib/catalog-feed-types";

const nextConfig: NextConfig = {
  /* Next.js 16 removed the `dynamic`, `revalidate`, and `fetchCache` route
     segment exports when Cache Components is enabled. Public catalog caching is
     therefore expressed with the `use cache` directive plus `cacheLife`, and the
     `catalogFeed` profile below is the project-wide lifetime that every public
     Firestore read must use. The duration comes from FEED_CACHE_SECONDS in
     lib/catalog-feed-types.ts so the cache window is defined in exactly one place. */
  cacheComponents: true,
  cacheLife: {
    catalogFeed: {
      stale: 60 * 60,
      revalidate: FEED_CACHE_SECONDS,
      expire: 7 * 24 * 60 * 60,
    },
    libraryFeed: {
      stale: 60,
      revalidate: 10 * 60,
      expire: 24 * 60 * 60,
    },
  },
};

export default nextConfig;
