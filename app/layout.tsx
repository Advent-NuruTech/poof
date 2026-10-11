import type { Metadata } from "next";
import { Oswald } from "next/font/google";
import "./globals.css";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Faith of the Pioneers | Watch and Discover",
  description: "Watch Bible studies, worship, sermons, and ministry videos from Faith of the Pioneers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body className={oswald.variable}>{children}</body></html>;
}
