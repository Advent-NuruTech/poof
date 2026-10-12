import { createPageMetadata, siteDescription } from "@/lib/seo";
import HomeScreen from "@/components/home/home-screen";

export const metadata = createPageMetadata({
  title: "Online Bible Study, Meetings & Ministry",
  description: siteDescription,
  path: "/",
});

export default function Home() {
  return <HomeScreen />;
}
