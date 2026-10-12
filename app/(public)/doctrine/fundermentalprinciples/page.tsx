import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Fundamental Principles",
  description:
    "Explore the Bible-centered fundamental principles and present truth held by the pioneers of our faith.",
  path: "/doctrine/fundermentalprinciples",
});

export default function FundamentalPrinciplesPage() {
  return (
    <main className="doctrine-page">
      <header className="doctrine-header">
        <a href="/">← Back to home</a>
        <span>OUR FAITH</span>
        <h1>Fundamental Principles</h1>
        <p>This page is being prepared. Explore messages and Bible study from Faith of the Pioneers on the homepage.</p>
        <a className="doctrine-home-link" href="/">Explore videos</a>
      </header>
    </main>
  );
}
