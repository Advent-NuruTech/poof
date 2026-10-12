import { createPageMetadata, siteDescription } from "@/lib/seo";
import HomeScreen from "@/components/home/home-screen";

export const metadata = createPageMetadata({
  title: "Faith of the Pioneers | Online Bible Study, Meetings & Ministry",
  description: siteDescription,
  path: "/",
  absoluteTitle: true,
});

export default function Home() {
  return <HomeScreen />;
}
