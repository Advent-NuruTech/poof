import { NextResponse } from "next/server";
import { getPublicLibrary } from "@/lib/library-feed";

export async function GET() {
  const library = await getPublicLibrary();
  return NextResponse.json(library, {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
  });
}
