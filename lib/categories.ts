// Enkel, enhetlig kategorisering av nyheter utifrån rubrik + ingress.
// RSS-källornas egna <category>-taggar är för spretiga mellan tidningarna,
// så vi härleder en egen gemensam taxonomi med nyckelord i stället.
// Lägg gärna till fler ord – ordningen i CATEGORIES avgör prioritet vid träff.

export type Category = {
  id: string;
  label: string;
  // Ord som klassar en nyhet till kategorin (matchas som hela ord, skiftlägesokänsligt)
  keywords: string[];
};

// Specifika kategorier först – mer generella sist. "ovrigt" är fallback.
export const CATEGORIES: Category[] = [
  {
    id: "sport",
    label: "Sport",
    keywords: [
      "sport", "fotboll", "hockey", "allsvenskan", "shl", "match", "mål",
      "tränare", "landslaget", "os", "vm", "em", "mästerskap", "tennis",
      "golf", "boxning", "f1", "formel", "skidor", "längdskidor", "biathlon",
      "handboll", "basket", "derby", "liga", "cup", "spelare", "seger",
    ],
  },
  {
    id: "ekonomi",
    label: "Ekonomi",
    keywords: [
      "ekonomi", "börs", "börsen", "ränta", "räntan", "inflation", "krona",
      "kronan", "aktie", "aktier", "konjunktur", "bnp", "riksbanken", "bolag",
      "företag", "vinst", "förlust", "konkurs", "varsel", "lön", "skatt",
      "budget", "miljarder", "investerare", "marknaden", "dollar", "euro",
    ],
  },
  {
    id: "politik",
    label: "Politik",
    keywords: [
      "politik", "riksdag", "riksdagen", "regering", "regeringen", "parti",
      "partiet", "minister", "statsminister", "val", "valet", "väljare",
      "opposition", "kommun", "moderaterna", "socialdemokraterna", "sd",
      "centerpartiet", "liberalerna", "kristdemokraterna", "miljöpartiet",
      "vänsterpartiet", "eu", "lagförslag", "reform", "debatt",
    ],
  },
  {
    id: "noje",
    label: "Nöje & kultur",
    keywords: [
      "nöje", "kultur", "film", "musik", "artist", "kändis", "festival",
      "konsert", "album", "skivbolag", "tv", "serie", "premiär", "scen",
      "teater", "konst", "bok", "författare", "melodifestivalen", "eurovision",
      "hollywood", "stjärna", "röda mattan", "gala",
    ],
  },
  {
    id: "teknik",
    label: "Vetenskap & teknik",
    keywords: [
      "teknik", "vetenskap", "forskning", "forskare", "studie", "ai",
      "artificiell intelligens", "rymd", "rymden", "klimat", "klimatet",
      "miljö", "energi", "el", "elpris", "innovation", "app", "internet",
      "data", "cyber", "hälsa", "medicin", "vaccin", "sjukdom",
    ],
  },
];

const FALLBACK_ID = "ovrigt";
const FALLBACK_LABEL = "Övrigt";

// Alla kategorier inkl. fallback – används för att rendera filtren.
export const ALL_CATEGORIES: { id: string; label: string }[] = [
  ...CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  { id: FALLBACK_ID, label: FALLBACK_LABEL },
];

// Förkompilera ett ord-regex per nyckelord. Lookbehind/lookahead ger
// ordgräns som även respekterar svenska tecken (å, ä, ö).
const COMPILED: { id: string; res: RegExp[] }[] = CATEGORIES.map((c) => ({
  id: c.id,
  res: c.keywords.map(
    (kw) =>
      new RegExp(`(?<![a-zåäöéèü])${escapeRegExp(kw)}(?![a-zåäöéèü])`, "i")
  ),
}));

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Returnerar kategori-id för en nyhet. Första kategorin med en träff vinner.
export function categorize(title: string, summary: string): string {
  const haystack = `${title} ${summary}`;
  for (const cat of COMPILED) {
    if (cat.res.some((re) => re.test(haystack))) return cat.id;
  }
  return FALLBACK_ID;
}
