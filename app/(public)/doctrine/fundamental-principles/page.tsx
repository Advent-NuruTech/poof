import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";
import FundamentalPrinciplesPage from "@/components/home/fundamental-principles-page";

export const metadata: Metadata = createPageMetadata({
  title: "Fundamental Principles",
  description:
    "Read the Bible-centered fundamental principles and present truth held by the pioneers of our faith — the 1872 declaration and the 1889 revised declaration — and download a clean, styled PDF copy of each.",
  path: "/doctrine/fundamental-principles",
});

export default function FundamentalPrinciplesRoute() {
  return <FundamentalPrinciplesPage />;
}
