import { getPublicLibrary } from "@/lib/library-feed";

export type PublicLibraryDocument = { title: string; description?: string; previewUrl?: string; kind?: "note" | "pdf" | "doc" };

/** Reads only the public fields needed to build a share preview for one study. */
export async function getPublicLibraryDocument(id: string): Promise<PublicLibraryDocument | null> {
  const document = (await getPublicLibrary()).documents.find((item) => item.id === id);
  return document ? {
    title: document.title,
    ...(document.description ? { description: document.description } : {}),
    ...(document.previewUrl ? { previewUrl: document.previewUrl } : {}),
    ...(document.kind ? { kind: document.kind } : {}),
  } : null;
}
