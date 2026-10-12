import type { Metadata } from "next";

const configuredSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://faithofthepioneers.org";

export const siteMetadataBase = new URL(configuredSiteUrl);

export const siteDescription =
  "Join online Bible meetings for Bible study, Christian ministry, the health message, the sanctuary, and present truth rooted in the pioneers' faith.";

export const siteLogo = "/images/logo.jpeg";

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "article" | "website";
};

export function createPageMetadata({
  title,
  description,
  path,
  image = siteLogo,
  type = "website",
}: PageMetadataOptions): Metadata {
  const images = [
    { url: image, alt: "Faith of the Pioneers" },
    ...(image === siteLogo ? [] : [{ url: siteLogo, alt: "Faith of the Pioneers logo" }]),
  ];

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      type,
      siteName: "Faith of the Pioneers",
      locale: "en_US",
      url: new URL(path, siteMetadataBase).toString(),
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image === siteLogo ? [image] : [image, siteLogo],
    },
  };
}
