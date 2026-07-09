// Svenska nyhetskällor och deras RSS-flöden.
// Lägg gärna till fler – varje källa hämtas oberoende och fel på en
// källa stoppar inte de andra.

export type Source = {
  id: string;
  name: string;
  // Kortnamn som visas som "badge" på varje nyhet
  label: string;
  // Färg för källans badge (CSS-färg)
  color: string;
  feedUrl: string;
};

export const SOURCES: Source[] = [
  {
    id: "aftonbladet",
    name: "Aftonbladet",
    label: "AB",
    color: "#ff3b30",
    feedUrl: "https://rss.aftonbladet.se/rss2/small/pages/sections/senastenytt/",
  },
  {
    id: "expressen",
    name: "Expressen",
    label: "EXP",
    color: "#003cff",
    feedUrl: "https://feeds.expressen.se/nyheter/",
  },
  {
    id: "dn",
    name: "Dagens Nyheter",
    label: "DN",
    color: "#0a3d62",
    feedUrl: "https://www.dn.se/rss/",
  },
  {
    id: "svd",
    name: "Svenska Dagbladet",
    label: "SvD",
    color: "#c8102e",
    feedUrl: "https://www.svd.se/feed/articles.rss",
  },
  {
    id: "di",
    name: "Dagens industri",
    label: "DI",
    color: "#e8830c",
    feedUrl: "https://www.di.se/rss",
  },
];

export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));
