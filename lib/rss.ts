import Parser from "rss-parser";
import { SOURCES, type Source } from "./sources";
import { categorize, type CategoryId } from "./categories";

export type RelatedNewsItem = {
  id: string;
  title: string;
  link: string;
  sourceId: string;
  sourceName: string;
  sourceLabel: string;
  sourceColor: string;
  publishedAt: number | null; // epoch ms
};

export type NewsItem = RelatedNewsItem & {
  summary: string;
  imageUrl: string | null;
  category: CategoryId; // kategori-id, se lib/categories.ts
  related: RelatedNewsItem[];
};

export type NewsResult = {
  items: NewsItem[];
  fetchedAt: number;
  // Källor som inte gick att hämta just nu
  failedSources: string[];
};

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
    ],
  },
});

// Hur länge varje RSS-svar får cachas (delad, persistent Next.js Data Cache).
const CACHE_TTL_SECONDS = 5 * 60; // 5 minuter

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
  // Hämta via fetch så svaret hamnar i Next.js Data Cache. Den är persistent
  // och delas mellan alla serverless-anrop på Vercel – till skillnad från en
  // minnescache som nollställs vid varje cold start.
  const res = await fetch(source.feedUrl, {
    headers: { "User-Agent": "Vadsker/0.1 (news aggregator)" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: CACHE_TTL_SECONDS },
  });
  if (!res.ok) throw new Error(`${source.name}: HTTP ${res.status}`);
  const xml = await res.text();
  const feed = await parser.parseString(xml);
  return (feed.items || []).map((item, idx) => {
    const link = item.link || "";
    const title = stripHtml(item.title) || "(utan rubrik)";
    const summary = stripHtml(item.contentSnippet || item.content).slice(0, 280);
    return {
      id: `${source.id}:${item.guid || link || idx}`,
      title,
      summary,
      link,
      imageUrl: extractImage(item as RawItem),
      sourceId: source.id,
      sourceName: source.name,
      sourceLabel: source.label,
      sourceColor: source.color,
      category: categorize(title, summary),
      publishedAt: parseDate(item),
      related: [],
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

const TITLE_STOPWORDS = new Set([
  "alla",
  "blev",
  "blir",
  "efter",
  "eller",
  "enligt",
  "fran",
  "från",
  "inte",
  "med",
  "mot",
  "nya",
  "och",
  "over",
  "över",
  "sade",
  "sager",
  "säger",
  "ska",
  "som",
  "till",
  "under",
  "utan",
  "vill",
]);

function tokenSet(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(" ")
      .filter((w) => w.length > 3 && !TITLE_STOPWORDS.has(w))
  );
}

// Jaccard-likhet mellan två rubrikers ordmängder.
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

function sharedTokenCount(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const w of a) if (b.has(w)) count++;
  return count;
}

function withinStoryWindow(a: NewsItem, b: NewsItem): boolean {
  if (!a.publishedAt || !b.publishedAt) return true;
  return Math.abs(a.publishedAt - b.publishedAt) <= 48 * 60 * 60 * 1000;
}

function sameStory(
  kept: { item: NewsItem; tokens: Set<string> },
  item: NewsItem,
  tokens: Set<string>
): boolean {
  if (!withinStoryWindow(kept.item, item)) return false;

  const score = similarity(kept.tokens, tokens);
  if (score >= 0.6) return true;

  return (
    kept.item.category === item.category &&
    score >= 0.42 &&
    sharedTokenCount(kept.tokens, tokens) >= 3
  );
}

function toRelatedItem(item: NewsItem): RelatedNewsItem {
  return {
    id: item.id,
    title: item.title,
    link: item.link,
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    sourceLabel: item.sourceLabel,
    sourceColor: item.sourceColor,
    publishedAt: item.publishedAt,
  };
}

// Slår ihop nyheter som handlar om samma sak och behåller andra medier som länkar.
function groupRelatedStories(items: NewsItem[]): NewsItem[] {
  const kept: {
    item: NewsItem;
    tokens: Set<string>;
    sourceIds: Set<string>;
    links: Set<string>;
  }[] = [];

  for (const item of items) {
    const tokens = tokenSet(item.title);
    const dup = kept.find((k) => sameStory(k, item, tokens));

    if (!dup) {
      kept.push({
        item: { ...item, related: [] },
        tokens,
        sourceIds: new Set([item.sourceId]),
        links: new Set([item.link]),
      });
      continue;
    }

    if (dup.links.has(item.link)) continue;
    dup.links.add(item.link);

    // Flera träffar från samma källa är oftast uppdateringar eller dubletter.
    if (dup.sourceIds.has(item.sourceId)) continue;

    dup.sourceIds.add(item.sourceId);
    dup.item.related.push(toRelatedItem(item));
  }

  return kept.map((k) => ({
    ...k.item,
    related: k.item.related.sort(
      (a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0)
    ),
  }));
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

  // Artiklar utan länk går inte att läsa vidare från, så visa dem inte.
  items = items.filter((item) => item.link);

  // Sortera nyast först (saknad tid hamnar sist)
  items.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  items = groupRelatedStories(items);

  return { items, fetchedAt: Date.now(), failedSources };
}

export async function getNews(): Promise<NewsResult> {
  // Cachen sköts nu per RSS-hämtning av Next.js Data Cache (se fetchSource).
  return aggregate();
}
