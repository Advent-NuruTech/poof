// Route segment config (`runtime`, `dynamic`, `revalidate`) is not allowed while
// `nextConfig.cacheComponents` is enabled. Node is the default runtime here.

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const source = requestUrl.searchParams.get("url");
  const requestedName = requestUrl.searchParams.get("name") ?? "document";
  if (!source) return Response.json({ error: "Missing document URL." }, { status: 400 });
  try {
    const parsed = new URL(source);
    if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") return Response.json({ error: "Unsupported document URL." }, { status: 400 });
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
