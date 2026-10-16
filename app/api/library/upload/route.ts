import { authorizeAdminRequest } from "@/lib/server-admin-auth";
import { createDocumentKey, createR2UploadUrl, documentPublicUrl } from "@/lib/r2";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "ppt", "pptx"]);

export async function POST(request: Request) {
  if (!await authorizeAdminRequest(request)) return Response.json({ error: "Sign in as an administrator to upload." }, { status: 403 });
  try {
    const body = await request.json() as { fileName?: unknown; contentType?: unknown; size?: unknown };
    const fileName = typeof body.fileName === "string" ? body.fileName.trim().replace(/[\\/\r\n\0]/g, "_").slice(0, 180) : "";
    const size = typeof body.size === "number" ? body.size : 0;
    const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (!fileName || !ALLOWED_EXTENSIONS.has(extension)) return Response.json({ error: "Choose a PDF, Word, or PowerPoint file." }, { status: 400 });
    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES) return Response.json({ error: "Files must be no larger than 25 MB." }, { status: 413 });

    const key = createDocumentKey(fileName);
    const uploadUrl = createR2UploadUrl(key);
    const secureUrl = documentPublicUrl(key);
    return Response.json({ uploadUrl, secureUrl, key }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "Could not prepare this upload." }, { status: 500 });
  }
}
