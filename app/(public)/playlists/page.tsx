import { createPageMetadata } from "@/lib/seo";
import PlaylistsPage from "@/components/home/playlists-page";

export const metadata = createPageMetadata({
  title: "Bible Study and Ministry Playlists",
  description:
    "Browse video playlists for Bible study, Christian ministry, worship, and present truth with Faith of the Pioneers.",
  path: "/playlists",
});

export default function PlaylistsIndexPage() {
  return <PlaylistsPage />;
}
