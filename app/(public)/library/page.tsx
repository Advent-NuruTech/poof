import { createPageMetadata } from "@/lib/seo";
import LibraryPage from "@/components/home/library-page";

export const metadata = createPageMetadata({
  title: "Bible Study Library",
  description:
    "Explore Bible studies and ministry resources on present truth, the sanctuary, the health message, and the historic faith of the pioneers.",
  path: "/library",
});

export default function LibraryRoute() { return <LibraryPage/>; }
