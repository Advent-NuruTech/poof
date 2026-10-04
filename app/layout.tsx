import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pioneers of Our Faith | Watch and Discover",
  description: "Watch Bible studies, worship, sermons, and ministry videos from Pioneers of Our Faith.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body>{children}</body></html>;
}
