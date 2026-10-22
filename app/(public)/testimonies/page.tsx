import Testimonies from "@/components/home/testimonies";
import { createPageMetadata } from "@/lib/seo";
export const metadata = createPageMetadata({ title: "Testimonies", description: "Stories of faith from the Faith of the Pioneers community.", path: "/testimonies" });
export default function TestimoniesPage() { return <Testimonies/>; }
