import LibraryPage from "@/components/home/library-page";

export default async function LibraryReaderRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LibraryPage documentId={id}/>;
}
