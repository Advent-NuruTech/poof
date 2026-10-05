import { createHash } from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!token || !projectId || !cloudName || !apiKey || !apiSecret) return Response.json({ error: "Library uploads are not configured." }, { status: 401 });
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return Response.json({ error: "Sign in as an administrator to upload." }, { status: 401 });
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as { user_id?: string; sub?: string };
    const uid = payload.user_id ?? payload.sub;
    if (!uid || uid.length > 128) return Response.json({ error: "Invalid administrator session." }, { status: 401 });
    const adminResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!adminResponse.ok) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const admin = await adminResponse.json() as { fields?: { enabled?: { booleanValue?: boolean }; expiresAt?: { timestampValue?: string } } };
    if (admin.fields?.enabled?.booleanValue !== true || Date.parse(admin.fields.expiresAt?.timestampValue ?? "") <= Date.now()) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type) && !/\.docx?$/i.test(file.name)) return Response.json({ error: "Choose a PDF, DOC, or DOCX file." }, { status: 400 });
    if (file.size > 25 * 1024 * 1024) return Response.json({ error: "Files must be 25 MB or smaller." }, { status: 413 });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params = `folder=library&timestamp=${timestamp}`;
    const signature = createHash("sha1").update(`${params}${apiSecret}`).digest("hex");
    const body = new FormData(); body.set("file", file); body.set("api_key", apiKey); body.set("timestamp", timestamp); body.set("folder", "library"); body.set("signature", signature);
    const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/raw/upload`, { method: "POST", body, cache: "no-store" });
    const result = await cloudinaryResponse.json() as { secure_url?: string; error?: { message?: string } };
    if (!cloudinaryResponse.ok || !result.secure_url) return Response.json({ error: result.error?.message ?? "Cloudinary could not upload this file." }, { status: 502 });
    return Response.json({ secureUrl: result.secure_url });
  } catch (reason) { return Response.json({ error: reason instanceof Error ? reason.message : "Could not upload file." }, { status: 500 }); }
}
