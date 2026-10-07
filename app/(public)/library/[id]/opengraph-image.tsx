import { ImageResponse } from "next/og";
import { getPublicLibraryDocument } from "@/lib/public-library";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** A reliable thumbnail for notes and files that do not have an uploaded preview image. */
export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const study = await getPublicLibraryDocument(id);
  const title = study?.title ?? "Faith of the Pioneers Library";
  const description = study?.description ?? "Study resources, reading notes, and playlists for quiet reflection.";

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#f7f7f4", color: "#101214", padding: 52 }}>
      {study?.previewUrl ? <img src={study.previewUrl} width="360" height="526" style={{ objectFit: "contain", background: "white", border: "1px solid #deded9" }} /> : <div style={{ width: 360, height: 526, display: "flex", alignItems: "center", justifyContent: "center", background: "#111719", color: "white", fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>STUDY</div>}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 54, maxWidth: 690 }}>
        <div style={{ display: "flex", color: "#c51c31", fontSize: 22, fontWeight: 700, letterSpacing: 4, marginBottom: 24 }}>FAITH OF THE PIONEERS</div>
        <div style={{ display: "flex", fontSize: 58, lineHeight: 1.05, fontWeight: 700, letterSpacing: -2 }}>{title}</div>
        <div style={{ display: "flex", marginTop: 30, fontSize: 26, lineHeight: 1.35, color: "#53595d" }}>{description}</div>
      </div>
    </div>,
    size,
  );
}
