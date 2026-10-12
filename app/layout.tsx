import type { Metadata } from "next";
import { Oswald } from "next/font/google";
import { siteDescription, siteLogo, siteMetadataBase } from "@/lib/seo";
import "./globals.css";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: siteMetadataBase,
  title: {
    default: "Faith of the Pioneers | Online Bible Study & Meetings",
    template: "%s | Faith of the Pioneers",
  },
  description: siteDescription,
  applicationName: "Faith of the Pioneers",
  keywords: [
    "online Bible meetings",
    "Bible study",
    "Christian ministry",
    "health message",
    "sanctuary study",
    "present truth",
    "Adventist pioneers",
    "Christian fellowship",
  ],
  icons: {
    icon: siteLogo,
    shortcut: siteLogo,
    apple: siteLogo,
  },
  openGraph: {
    type: "website",
    siteName: "Faith of the Pioneers",
    locale: "en_US",
    title: "Faith of the Pioneers | Online Bible Study & Meetings",
    description: siteDescription,
    images: [{ url: siteLogo, alt: "Faith of the Pioneers logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Faith of the Pioneers | Online Bible Study & Meetings",
    description: siteDescription,
    images: [siteLogo],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body className={oswald.variable}>{children}</body></html>;
}
