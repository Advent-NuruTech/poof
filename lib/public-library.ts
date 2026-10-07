export type PublicLibraryDocument = { title: string; description?: string; previewUrl?: string; kind?: "note" | "pdf" | "doc" };
type FirestoreLibraryDocument = { fields?: { title?: { stringValue?: string }; description?: { stringValue?: string }; previewUrl?: { stringValue?: string }; kind?: { stringValue?: "note" | "pdf" | "doc" } } };

/** Reads only the public fields needed to build a share preview for one study. */
export async function getPublicLibraryDocument(id: string): Promise<PublicLibraryDocument | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return null;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/libraryDocuments/${encodeURIComponent(id)}?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const fields = (await response.json() as FirestoreLibraryDocument).fields;
    const title = fields?.title?.stringValue;
    return title ? { title, ...(fields?.description?.stringValue ? { description: fields.description.stringValue } : {}), ...(fields?.previewUrl?.stringValue ? { previewUrl: fields.previewUrl.stringValue } : {}), ...(fields?.kind?.stringValue ? { kind: fields.kind.stringValue } : {}) } : null;
  } catch { return null; }
}
