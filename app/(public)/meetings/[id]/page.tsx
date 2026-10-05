import type { Metadata } from "next";
import MeetingDetail from "@/components/home/meeting-detail";

type MeetingDocument = {
  fields?: { title?: { stringValue?: string }; description?: { stringValue?: string }; posterUrl?: { stringValue?: string } };
};

async function getMeeting(id: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return null;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/meetings/${encodeURIComponent(id)}?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) return null;
    return await response.json() as MeetingDocument;
  } catch { return null; }
}

export async function generateMetadata({ params }: PageProps<"/meetings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const fields = (await getMeeting(id))?.fields;
  const title = fields?.title?.stringValue;
  if (!title) return { title: "Meeting unavailable" };
  const description = fields?.description?.stringValue;
  const poster = fields?.posterUrl?.stringValue;
  const images = poster ? [{ url: poster }] : [];
  return {
    title,
    ...(description ? { description } : {}),
    openGraph: { title, ...(description ? { description } : {}), type: "website", ...(images.length ? { images } : {}) },
    twitter: { card: poster ? "summary_large_image" : "summary", title, ...(description ? { description } : {}), ...(poster ? { images: [poster] } : {}) },
  };
}

export default async function MeetingDetailPage({ params }: PageProps<"/meetings/[id]">) {
  const { id } = await params;
  return <MeetingDetail id={id}/>;
}
