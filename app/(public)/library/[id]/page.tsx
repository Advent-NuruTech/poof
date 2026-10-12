import type { Metadata } from "next";
import LibraryPage from "@/components/home/library-page";
import { createPageMetadata } from "@/lib/seo";
import { getPublicLibraryDocument } from "@/lib/public-library";

export async function generateMetadata({ params }: PageProps<"/library/[id]">): Promise<Metadata> {
  const { id } = await params;
  const study = await getPublicLibraryDocument(id);
  if (!study) return { title: "Study unavailable" };
  const description = study.description || `Read ${study.title} in the Faith of the Pioneers library.`;
  return createPageMetadata({
    title: study.title,
    description,
    path: `/library/${encodeURIComponent(id)}`,
    image: study.previewUrl,
    type: "article",
  });
}

// `params` is runtime data, so the reader cannot be prerendered without a
// Suspense placeholder. `instant = false` is the documented Cache Components
// opt-out for a route that is allowed to block while it resolves its params.
export const instant = false;

export default async function LibraryReaderRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LibraryPage documentId={id}/>;
}
