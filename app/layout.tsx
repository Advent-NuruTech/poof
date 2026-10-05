import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Faith of the Pioneers | Watch and Discover",
  description: "Watch Bible studies, worship, sermons, and ministry videos from Faith of the Pioneers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body>{children}</body></html>;
}
