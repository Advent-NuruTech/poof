import { createPageMetadata } from "@/lib/seo";
import MeetingsPage from "@/components/home/meetings-page";

export const metadata = createPageMetadata({
  title: "Online Bible Meetings",
  description:
    "Join online Bible meetings for Scripture study, worship, prayer, and Christian fellowship with Faith of the Pioneers.",
  path: "/meetings",
});

export default function ZoomMeetingsPage() {
  return <MeetingsPage />;
}
