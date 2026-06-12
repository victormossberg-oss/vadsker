import Parser from "rss-parser";
import { SOURCES, type Source } from "./sources";

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  link: string;
  imageUrl: string | null;
  sourceId: string;
  sourceName: string;
  sourceLabel: string;
  sourceColor: string;
  publishedAt: number | null; // epoch ms
};

export type NewsResult = {
  items: NewsItem[];
  fetchedAt: number;
  // Källor som inte gick att hämta just nu
  failedSources: string[];
};

const parser = new Parser({
  timeout: 8000,
  headers: { "User-Agent": "Vadsker/0.1 (news aggregator)" },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
    ],
  },
});

type RawItem = {
  enclosure?: { url?: string; type?: string };
  mediaContent?: Array<{ $?: { url?: string; medium?: string; type?: string } }>;
  mediaThumbnail?: Array<{ $?: { url?: string } }>;
  content?: string;
  "content:encoded"?: string;
};

// Plocka ut en bild-URL ur de vanligaste RSS-varianterna.
function extractImage(item: RawItem): string | null {
  const enc = item.enclosure;
  if (enc?.url && (!enc.type || enc.type.startsWith("image"))) return enc.url;

  const mc = item.mediaContent?.find(
    (m) => m.$?.url && (m.$.medium === "image" || m.$.type?.startsWith("image") || /\.(jpg|jpeg|png|webp)/i.test(m.$.url))
  );
  if (mc?.$?.url) return mc.$.url;

  const mt = item.mediaThumbnail?.find((m) => m.$?.url);
  if (mt?.$?.url) return mt.$.url;

  // Sista utväg: första <img> i innehållet.
  const html = item["content:encoded"] || item.content || "";
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

// Enkel in-memory-cache så vi inte spammar källorna.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuter
let cache: { data: NewsResult; expires: number } | null = null;
let inFlight: Promise<NewsResult> | null = null;

function stripHtml(input: string | undefined): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(item: { isoDate?: string; pubDate?: string }): number | null {
  const raw = item.isoDate || item.pubDate;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

async function fetchSource(source: Source): Promise<NewsItem[]> {
  const feed = await parser.parseURL(source.feedUrl);
  return (feed.items || []).map((item, idx) => {
    const link = item.link || "";
    return {
      id: `${source.id}:${item.guid || link || idx}`,
      title: stripHtml(item.title) || "(utan rubrik)",
      summary: stripHtml(item.contentSnippet || item.content).slice(0, 280),
      link,
      imageUrl: extractImage(item as RawItem),
      sourceId: source.id,
      sourceName: source.name,
      sourceLabel: source.label,
      sourceColor: source.color,
      publishedAt: parseDate(item),
    };
  });
}

// Normalisera en rubrik för dedup-jämförelse.
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\wåäöéèüçñ\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(title: string): Set<string> {
  return new Set(normalizeTitle(title).split(" ").filter((w) => w.length > 3));
}

// Jaccard-likhet mellan två rubrikers ordmängder.
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

// Slår ihop nyheter som handlar om samma sak (mycket lika rubriker).
function dedupe(items: NewsItem[]): NewsItem[] {
  const kept: { item: NewsItem; tokens: Set<string> }[] = [];
  for (const item of items) {
    const tokens = tokenSet(item.title);
    const dup = kept.find((k) => similarity(k.tokens, tokens) >= 0.6);
    if (!dup) kept.push({ item, tokens });
  }
  return kept.map((k) => k.item);
}

async function aggregate(): Promise<NewsResult> {
  const failedSources: string[] = [];
  const results = await Promise.allSettled(SOURCES.map(fetchSource));

  let items: NewsItem[] = [];
  results.forEach((res, i) => {
    if (res.status === "fulfilled") {
      items.push(...res.value);
    } else {
      failedSources.push(SOURCES[i].name);
    }
  });

  // Sortera nyast först (saknad tid hamnar sist)
  items.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  items = dedupe(items);

  return { items, fetchedAt: Date.now(), failedSources };
}

export async function getNews(force = false): Promise<NewsResult> {
  const now = Date.now();
  if (!force && cache && cache.expires > now) return cache.data;
  if (inFlight) return inFlight;

  inFlight = aggregate()
    .then((data) => {
      cache = { data, expires: Date.now() + CACHE_TTL_MS };
      return data;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
