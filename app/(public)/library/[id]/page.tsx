import LibraryPage from "@/components/home/library-page";

// `params` is runtime data, so the reader cannot be prerendered without a
// Suspense placeholder. `instant = false` is the documented Cache Components
// opt-out for a route that is allowed to block while it resolves its params.
export const instant = false;

export default async function LibraryReaderRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LibraryPage documentId={id}/>;
}
