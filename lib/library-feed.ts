import { cacheLife } from "next/cache";
import type { LibraryCategory, LibraryDocument } from "@/lib/library";

const MAX_LIBRARY_ROWS = 900;
const TIMEOUT_MS = 8000;

type Wire = Record<string, unknown>;
type RestDocument = { name?: string; fields?: Record<string, unknown> };

function decode(value: unknown): unknown {
  if (!value || typeof value !== "object") return undefined;
  const wire = value as Wire;
  if ("stringValue" in wire) return wire.stringValue;
  if ("booleanValue" in wire) return wire.booleanValue;
  if ("integerValue" in wire) return Number(wire.integerValue);
  if ("doubleValue" in wire) return Number(wire.doubleValue);
  if ("timestampValue" in wire) return wire.timestampValue;
  if ("nullValue" in wire) return null;
  if ("arrayValue" in wire) return ((wire.arrayValue as { values?: unknown[] }).values ?? []).map(decode);
  if ("mapValue" in wire) return decodeFields((wire.mapValue as { fields?: Record<string, unknown> }).fields ?? {});
  return undefined;
}

function decodeFields(fields: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}

async function readCollection<T>(name: string): Promise<T[]> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return [];
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${name}?pageSize=${MAX_LIBRARY_ROWS}&key=${encodeURIComponent(apiKey)}`;
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return [];
    const body = await response.json() as { documents?: RestDocument[] };
    return (body.documents ?? []).flatMap((item) => {
      const id = item.name?.slice(item.name.lastIndexOf("/") + 1);
      return id && item.fields ? [{ id, ...decodeFields(item.fields) } as T] : [];
    });
  } catch {
    return [];
  }
}

export async function getPublicLibrary() {
  "use cache";
  cacheLife("libraryFeed");
  const [categories, documents] = await Promise.all([
    readCollection<LibraryCategory>("libraryCategories"),
    readCollection<LibraryDocument>("libraryDocuments"),
  ]);
  return {
    categories,
    documents: documents.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")),
    truncated: categories.length >= MAX_LIBRARY_ROWS || documents.length >= MAX_LIBRARY_ROWS,
  };
}
