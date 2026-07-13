"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NewsItem, NewsResult } from "@/lib/rss";
import { ALL_CATEGORIES, type CategoryId } from "@/lib/categories";

type NewsFilter = CategoryId | "all";

function relativeTime(ts: number | null, now: number): string {
  if (!ts) return "";
  const diff = Math.max(0, now - ts);
  const min = Math.round(diff / 60000);
  if (min < 1) return "nyss";
  if (min < 60) return `${min} min sedan`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} tim sedan`;
  const d = Math.round(h / 24);
  return `${d} dygn sedan`;
}

function Kicker({ item, now }: { item: NewsItem; now: number }) {
  const time = relativeTime(item.publishedAt, now);
  const sourceCount = 1 + item.related.length;

  return (
    <div className="kicker">
      <span className="kicker__source" style={{ color: item.sourceColor }}>
        {item.sourceName}
      </span>
      {time && <span className="kicker__time">{time}</span>}
      {item.related.length > 0 && (
        <span className="kicker__coverage">{sourceCount} källor</span>
      )}
    </div>
  );
}

function CoverageLinks({ related }: { related: NewsItem["related"] }) {
  if (related.length === 0) return null;

  return (
    <div className="coverage" aria-label="Andra källor för samma nyhet">
      <span className="coverage__label">Finns även på</span>
      {related.map((item) => (
        <a
          key={item.id}
          className="coverage__link"
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Läs hos ${item.sourceName}: ${item.title}`}
        >
          <span
            className="coverage__source"
            style={{ color: item.sourceColor }}
          >
            {item.sourceName}
          </span>
        </a>
      ))}
    </div>
  );
}

const PAGE_SIZE = 5;

export default function NewsFeed({ initial }: { initial: NewsResult }) {
  const [data, setData] = useState<NewsResult>(initial);
  const [now, setNow] = useState(initial.fetchedAt);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [category, setCategory] = useState<NewsFilter>("all");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/news", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`News refresh failed: ${res.status}`);
      }

      const nextData = (await res.json()) as NewsResult;
      setData(nextData);
      setVisibleCount(PAGE_SIZE); // börja om från toppen vid uppdatering
      setNow(Date.now());
    } catch {
      setRefreshError("Kunde inte uppdatera just nu. Försök igen om en stund.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Håll relativa tider aktuella utan att behöva hämta om nyheterna.
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Hämta nytt automatiskt var 5:e minut.
  useEffect(() => {
    const t = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const readableItems = useMemo(
    () => data.items.filter((item) => item.link),
    [data.items]
  );

  // Nyheterna kommer redan sorterade nyast först från servern.
  const items: NewsItem[] =
    category === "all"
      ? readableItems
      : readableItems.filter((i) => i.category === category);
  const shown = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;
  const updatedAt = relativeTime(data.fetchedAt, now);

  function selectCategory(id: NewsFilter) {
    setCategory(id);
    setVisibleCount(PAGE_SIZE); // börja om från toppen vid filterbyte
  }

  const [lead, ...rest] = shown;

  return (
    <>
      <div className="toolbar">
        <div className="toolbar__meta">
          <span className="count">Senaste nytt</span>
          <span className="updated">Uppdaterad {updatedAt}</span>
        </div>
        <button
          type="button"
          className="refresh"
          onClick={refresh}
          disabled={refreshing}
          aria-busy={refreshing}
          aria-label={refreshing ? "Uppdaterar nyheter" : "Uppdatera nyheter"}
        >
          {refreshing ? "Uppdaterar…" : "↻ Uppdatera"}
        </button>
      </div>

      <div className="filters" role="group" aria-label="Filtrera på kategori">
        <button
          type="button"
          className={`chip${category === "all" ? " chip--active" : ""}`}
          onClick={() => selectCategory("all")}
          aria-pressed={category === "all"}
        >
          Alla
        </button>
        {ALL_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip${category === c.id ? " chip--active" : ""}`}
            onClick={() => selectCategory(c.id)}
            aria-pressed={category === c.id}
          >
            {c.label}
          </button>
        ))}
      </div>

      {refreshError && (
        <p className="notice" role="status">
          {refreshError}
        </p>
      )}

      {data.failedSources.length > 0 && (
        <p className="notice" role="status">
          Kunde inte hämta från: {data.failedSources.join(", ")}
        </p>
      )}

      {lead && (
        <article className="lead">
          <a
            className="lead__main"
            href={lead.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            {lead.imageUrl && (
              <div className="lead__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lead.imageUrl}
                  alt=""
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
            )}
            <div className="lead__body">
              <Kicker item={lead} now={now} />
              <h2 className="lead__title">{lead.title}</h2>
              {lead.summary && <p className="lead__summary">{lead.summary}</p>}
            </div>
          </a>
          <CoverageLinks related={lead.related} />
        </article>
      )}

      <ul className="feed">
        {rest.map((item) => (
          <li key={item.id} className="story">
            <article className="story__article">
              <a
                className="story__main"
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.imageUrl && (
                  <div className="story__media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}
                <div className="story__body">
                  <Kicker item={item} now={now} />
                  <h3 className="story__title">{item.title}</h3>
                  {item.summary && (
                    <p className="story__summary">{item.summary}</p>
                  )}
                </div>
              </a>
              <CoverageLinks related={item.related} />
            </article>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
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
