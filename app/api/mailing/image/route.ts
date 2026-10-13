import { randomUUID } from "node:crypto";
import { getMailStorageBucket, requireMailAdmin } from "@/lib/mailing-server";

const maxImageSize = 5 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function POST(request: Request) {
  try {
    const adminId = await requireMailAdmin(request);
    if (!adminId) return Response.json({ error: "Administrator access is required." }, { status: 401 });

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > maxImageSize + 64 * 1024) {
      return Response.json({ error: "Choose an image smaller than 5 MB." }, { status: 413 });
    }

    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File)) return Response.json({ error: "Choose an image file to upload." }, { status: 400 });
    if (!allowedImageTypes.has(image.type)) {
      return Response.json({ error: "Use a JPEG, PNG, GIF, or WebP image." }, { status: 400 });
    }
    if (image.size === 0 || image.size > maxImageSize) {
      return Response.json({ error: "Choose an image larger than 0 bytes and smaller than 5 MB." }, { status: 413 });
    }

    const bucket = getMailStorageBucket();
    const token = randomUUID();
    const objectPath = `mailing-images/${randomUUID()}`;
    await bucket.file(objectPath).save(Buffer.from(await image.arrayBuffer()), {
      resumable: false,
      metadata: {
        contentType: image.type,
        cacheControl: "public, max-age=31536000, immutable",
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
    return Response.json({ imageUrl }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Mailing image upload failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "The image could not be uploaded." }, { status: 500 });
  }
}
