import {
  buildFundamentalPrinciplesPdf,
  getFundamentalPrinciplesDoc,
} from "@/lib/fundamental-principles-pdf";

// Route segment config (`runtime`, `dynamic`, `revalidate`) is not allowed while
// `nextConfig.cacheComponents` is enabled. Node is the default runtime here.
//
// `?year=1889` selects the 1889 revised declaration; the default is the 1872
// declaration. Reading `request.url` makes the handler render at request time.

export function GET(request: Request) {
  const year = new URL(request.url).searchParams.get("year");
  const doc = getFundamentalPrinciplesDoc(year);

  if (!doc) {
    return new Response(`Unknown year: ${year}`, { status: 404 });
  }

  const pdf = buildFundamentalPrinciplesPdf(doc);
  const body = new Uint8Array(pdf);
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fundamental-principles-${doc.year}.pdf"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
