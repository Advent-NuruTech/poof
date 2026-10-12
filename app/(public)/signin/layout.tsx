import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Administrator Sign In",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function SigninLayout({ children }: { children: React.ReactNode }) {
  return children;
}
