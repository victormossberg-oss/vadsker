import { NextResponse } from "next/server";
import { getNews } from "@/lib/rss";

// Routen körs per anrop, men RSS-hämtningarna inuti cachas av Next.js
// Data Cache i 5 min (se lib/rss.ts) – så källorna spammas inte.
export async function GET() {
  const data = await getNews();
  return NextResponse.json(data);
}
