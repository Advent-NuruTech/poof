import PlaylistsPage from "@/components/home/playlists-page";

export default async function PlaylistDetailPage({ params }: PageProps<"/playlists/[id]">) {
  const { id } = await params;
  return <PlaylistsPage playlistId={id} />;
}
