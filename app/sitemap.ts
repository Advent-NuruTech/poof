import type { MetadataRoute } from "next";
import { siteMetadataBase } from "@/lib/seo";

const publicPaths = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/meetings", changeFrequency: "daily", priority: 0.9 },
  { path: "/library", changeFrequency: "weekly", priority: 0.9 },
  { path: "/playlists", changeFrequency: "weekly", priority: 0.8 },
  {
    path: "/doctrine/fundermentalprinciples",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map(({ path, changeFrequency, priority }) => ({
    url: new URL(path, siteMetadataBase).toString(),
    changeFrequency,
    priority,
  }));
}
