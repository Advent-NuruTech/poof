import { queryD1 } from "@/lib/cloudflare-d1";
import { authorizeAdminRequest } from "@/lib/server-admin-auth";
import type { Video } from "@/lib/catalog";

type VideoRow = { data_json: string };

export async function GET(request: Request) {
  if (!await authorizeAdminRequest(request)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 40)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  try {
    const [rows, counts] = await Promise.all([
      queryD1<VideoRow>("SELECT data_json FROM videos ORDER BY published_at DESC LIMIT ? OFFSET ?", [limit, offset]),
      queryD1<{ total: number }>("SELECT COUNT(*) AS total FROM videos"),
    ]);
    const videos = rows.flatMap((row) => { try { return [JSON.parse(row.data_json) as Video]; } catch { return []; } });
    return Response.json({ videos, total: Number(counts[0]?.total ?? 0) }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "Could not load the video catalog." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!await authorizeAdminRequest(request)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  try {
    const body = await request.json() as { id?: unknown; website?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    const website = body.website && typeof body.website === "object" ? body.website as Record<string, unknown> : null;
    if (!/^[\w-]{6,20}$/.test(id) || !website || Object.keys(website).some((key) => !["hidden", "featured", "displayTitle", "category"].includes(key))) {
      return Response.json({ error: "A valid video ID and presentation update are required." }, { status: 400 });
    }
    const rows = await queryD1<VideoRow>("SELECT data_json FROM videos WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) return Response.json({ error: "That video was not found." }, { status: 404 });
    const video = JSON.parse(rows[0].data_json) as Video;
    const next = { ...video, website: { ...video.website, ...website } };
    await queryD1(
      "UPDATE videos SET data_json = ?, hidden = ?, updated_at = ? WHERE id = ?",
      [JSON.stringify(next), next.website.hidden === true ? 1 : 0, new Date().toISOString(), id],
    );
    return Response.json({ video: next }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "Could not update the video." }, { status: 503 });
  }
}
