"use client";

import { useEffect, useState } from "react";
import type { NewsItem, NewsResult } from "@/lib/rss";

function relativeTime(ts: number | null): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return "nyss";
  if (min < 60) return `${min} min sedan`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} tim sedan`;
  const d = Math.round(h / 24);
  return `${d} dygn sedan`;
}

function Kicker({ item }: { item: NewsItem }) {
  return (
    <div className="kicker">
      <span className="kicker__source" style={{ color: item.sourceColor }}>
        {item.sourceName}
      </span>
      <span className="kicker__time">{relativeTime(item.publishedAt)}</span>
    </div>
  );
}

const PAGE_SIZE = 5;

export default function NewsFeed({ initial }: { initial: NewsResult }) {
  const [data, setData] = useState<NewsResult>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/news", { cache: "no-store" });
      if (res.ok) {
        setData(await res.json());
        setVisibleCount(PAGE_SIZE); // börja om från toppen vid uppdatering
      }
    } catch {
      /* tyst – behåll befintlig data */
    } finally {
      setRefreshing(false);
    }
  }

  // Hämta nytt automatiskt var 5:e minut.
  useEffect(() => {
    const t = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Nyheterna kommer redan sorterade nyast först från servern.
  const items: NewsItem[] = data.items;
  const shown = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  const [lead, ...rest] = shown;

  return (
    <>
      <div className="toolbar">
        <span className="count">Senaste nytt</span>
        <button className="refresh" onClick={refresh} disabled={refreshing}>
          {refreshing ? "Uppdaterar…" : "↻ Uppdatera"}
        </button>
      </div>

      {data.failedSources.length > 0 && (
        <p className="notice">
          Kunde inte hämta från: {data.failedSources.join(", ")}
        </p>
      )}

      {lead && (
        <a
          className="lead"
          href={lead.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          {lead.imageUrl && (
            <div className="lead__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lead.imageUrl} alt="" loading="lazy" />
            </div>
          )}
          <div className="lead__body">
            <Kicker item={lead} />
            <h2 className="lead__title">{lead.title}</h2>
            {lead.summary && <p className="lead__summary">{lead.summary}</p>}
          </div>
        </a>
      )}

      <ul className="feed">
        {rest.map((item) => (
          <li key={item.id} className="story">
            <a href={item.link} target="_blank" rel="noopener noreferrer">
              {item.imageUrl && (
                <div className="story__media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt="" loading="lazy" />
                </div>
              )}
              <div className="story__body">
                <Kicker item={item} />
                <h3 className="story__title">{item.title}</h3>
                {item.summary && (
                  <p className="story__summary">{item.summary}</p>
                )}
              </div>
            </a>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          className="more"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
        >
          Visa fler nyheter
        </button>
      )}

      {items.length === 0 && (
        <p className="empty">Inga nyheter att visa just nu.</p>
      )}
    </>
  );
}
