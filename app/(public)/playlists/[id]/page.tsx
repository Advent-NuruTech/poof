import PlaylistsPage from "@/components/home/playlists-page";

// `params` is runtime data, so this route cannot be prerendered without a
// Suspense placeholder. `instant = false` is the documented Cache Components
// opt-out for a route that is allowed to block while it resolves its params.
export const instant = false;

export default async function PlaylistDetailPage({ params }: PageProps<"/playlists/[id]">) {
  const { id } = await params;
  return <PlaylistsPage playlistId={id} />;
}
