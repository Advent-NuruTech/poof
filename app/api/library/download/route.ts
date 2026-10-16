// Route segment config (`runtime`, `dynamic`, `revalidate`) is not allowed while
// `nextConfig.cacheComponents` is enabled. Node is the default runtime here.

import { validateR2PublicUrl } from "@/lib/r2";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const source = requestUrl.searchParams.get("url");
  const requestedName = requestUrl.searchParams.get("name") ?? "document";
  if (!source) return Response.json({ error: "Missing document URL." }, { status: 400 });
  try {
    const parsed = new URL(source);
    const isLegacyCloudinary = parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com";
    let isR2Document = false;
    try { isR2Document = validateR2PublicUrl(source); } catch { /* Existing Cloudinary documents remain downloadable without R2 settings. */ }
    if (!isLegacyCloudinary && !isR2Document) return Response.json({ error: "Unsupported document URL." }, { status: 400 });
    const upstream = await fetch(parsed, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) return Response.json({ error: "Could not retrieve document." }, { status: 502 });
    const safeName = requestedName.replace(/[\r\n"\\/]/g, "_").slice(0, 180) || "document";
    return new Response(upstream.body, { headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    } });
  } catch {
    return Response.json({ error: "Invalid document URL." }, { status: 400 });
  }
}
