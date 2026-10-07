import type { Metadata } from "next";
import LibraryPage from "@/components/home/library-page";
import { getPublicLibraryDocument } from "@/lib/public-library";

export async function generateMetadata({ params }: PageProps<"/library/[id]">): Promise<Metadata> {
  const { id } = await params;
  const study = await getPublicLibraryDocument(id);
  if (!study) return { title: "Study unavailable" };
  const description = study.description || `Read ${study.title} in the Faith of the Pioneers library.`;
  const images = study.previewUrl ? [{ url: study.previewUrl }] : undefined;
  return {
    title: study.title,
    description,
    openGraph: { title: study.title, description, type: "article", ...(images ? { images } : {}) },
    twitter: { card: study.previewUrl ? "summary_large_image" : "summary", title: study.title, description, ...(study.previewUrl ? { images: [study.previewUrl] } : {}) },
  };
}

// `params` is runtime data, so the reader cannot be prerendered without a
// Suspense placeholder. `instant = false` is the documented Cache Components
// opt-out for a route that is allowed to block while it resolves its params.
export const instant = false;

export default async function LibraryReaderRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LibraryPage documentId={id}/>;
}
