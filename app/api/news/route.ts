import { NextResponse } from "next/server";
import { getNews } from "@/lib/rss";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getNews();
  return NextResponse.json(data);
}
