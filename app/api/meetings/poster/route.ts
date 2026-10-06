import { createHash } from "node:crypto";

// Route segment config (`runtime`, `dynamic`, `revalidate`) is not allowed while
// `nextConfig.cacheComponents` is enabled. Node is the default runtime here.

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!token || !projectId || !cloudName || !apiKey || !apiSecret) return Response.json({ error: "Poster upload is not configured." }, { status: 401 });

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return Response.json({ error: "Sign in as an administrator to upload a poster." }, { status: 401 });
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as { user_id?: string; sub?: string };
    const uid = payload.user_id ?? payload.sub;
    if (!uid || uid.length > 128) return Response.json({ error: "Invalid administrator session." }, { status: 401 });
    const adminResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!adminResponse.ok) return Response.json({ error: "Administrator access is required to upload a poster." }, { status: 403 });
    const admin = await adminResponse.json() as { fields?: { enabled?: { booleanValue?: boolean }; expiresAt?: { timestampValue?: string } } };
    if (admin.fields?.enabled?.booleanValue !== true || Date.parse(admin.fields?.expiresAt?.timestampValue ?? "") <= Date.now()) return Response.json({ error: "Administrator access is required to upload a poster." }, { status: 403 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/")) return Response.json({ error: "Choose an image file." }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return Response.json({ error: "Poster images must be 10 MB or smaller." }, { status: 413 });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params = `folder=meetings&timestamp=${timestamp}`;
    const signature = createHash("sha1").update(`${params}${apiSecret}`).digest("hex");
    const upload = new FormData();
    upload.set("file", file);
    upload.set("api_key", apiKey);
    upload.set("timestamp", timestamp);
    upload.set("folder", "meetings");
    upload.set("signature", signature);
    const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: "POST", body: upload, cache: "no-store" });
    const result = await cloudinaryResponse.json() as { secure_url?: string; error?: { message?: string } };
    if (!cloudinaryResponse.ok || !result.secure_url) return Response.json({ error: result.error?.message ?? "Cloudinary could not upload this poster." }, { status: 502 });
    return Response.json({ secureUrl: result.secure_url });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "Could not upload this poster." }, { status: 500 });
  }
}
