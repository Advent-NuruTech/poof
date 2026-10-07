"use client";

import { useEffect, useState } from "react";
import type { LibraryCategory, LibraryDocument } from "@/lib/library";

type LibraryFeed = { categories: LibraryCategory[]; documents: LibraryDocument[]; truncated: boolean };
const EMPTY: LibraryFeed = { categories: [], documents: [], truncated: false };
let cached: LibraryFeed | null = null;
let cachedAt = 0;
let pending: Promise<LibraryFeed | null> | null = null;
const CACHE_MS = 10 * 60 * 1000;

async function fetchLibrary(): Promise<LibraryFeed | null> {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  if (!pending) pending = fetch("/api/library", { cache: "no-store" })
    .then((response) => response.ok ? response.json() as Promise<LibraryFeed> : null)
    .then((value) => { if (value) { cached = value; cachedAt = Date.now(); } return value; })
    .catch(() => null)
    .finally(() => { pending = null; });
  return pending;
}

export function usePublicLibrary() {
  const [feed, setFeed] = useState<LibraryFeed>(() => cached ?? EMPTY);
  const [loaded, setLoaded] = useState(() => cached !== null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetchLibrary().then((value) => {
      if (!active) return;
      if (value) setFeed(value);
      else setError("Could not load the library. Please try again.");
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);
  return { ...feed, loaded, error };
}
