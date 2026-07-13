// Enkel, enhetlig kategorisering av nyheter utifrån rubrik + ingress.
// RSS-källornas egna <category>-taggar är för spretiga mellan tidningarna,
// så vi härleder en egen gemensam taxonomi med nyckelord i stället.
// Starka ord kan själva välja kategori. Svaga ord räknas bara som stöd, så
// breda ord som "mål" eller "match" inte råkar göra en Ukraina-nyhet till sport.

export type CategoryId =
  | "sport"
  | "ekonomi"
  | "politik"
  | "noje"
  | "teknik"
  | "ovrigt";

type DefinedCategoryId = Exclude<CategoryId, "ovrigt">;

export type Category = {
  id: DefinedCategoryId;
  label: string;
  // Matchas som hela ord/fraser, skiftlägesokänsligt.
  strongKeywords: string[];
  weakKeywords?: string[];
  vetoKeywords?: string[];
};

// Vid lika poäng vinner den kategori som står först. "ovrigt" är fallback.
export const CATEGORIES: Category[] = [
  {
    id: "sport",
    label: "Sport",
    strongKeywords: [
      "sport", "fotboll", "hockey", "allsvenskan", "superettan", "shl",
      "fotbolls-vm", "fotbolls", "landslaget", "mästerskap",
      "mästerskapet", "tennis", "golf", "boxning", "f1", "formel 1",
      "formel", "skidor", "längdskidor", "biathlon",
      "skidskytte", "handboll", "basket", "derby", "liga", "cup",
      "spelare", "tränare", "ryttare", "hästsport", "friidrott",
      "kvartsfinal", "kvartsfinalen", "semifinal", "semifinalen",
      "olympiska spelen", "champions league",
    ],
    weakKeywords: [
      "match", "mål", "seger", "os", "vm", "em", "final", "tabell",
      "poäng",
    ],
    vetoKeywords: [
      "ukraina", "ryssland", "krig", "nato", "zelenskyj", "putin",
      "militär", "soldater", "attack", "robot", "drönare",
    ],
  },
  {
    id: "ekonomi",
    label: "Ekonomi",
    strongKeywords: [
      "ekonomi", "börs", "börsen", "ränta", "räntan", "inflation", "krona",
      "kronan", "aktie", "aktier", "konjunktur", "bnp", "riksbanken", "bolag",
      "företag", "konkurs", "varsel", "investerare",
    ],
    weakKeywords: [
      "vinst", "förlust", "lön", "skatt", "budget", "miljarder",
      "marknaden", "dollar", "euro",
    ],
  },
  {
    id: "politik",
    label: "Politik",
    strongKeywords: [
      "politik", "riksdag", "riksdagen", "regering", "regeringen", "parti",
      "partiet", "minister", "statsminister", "val", "valet", "väljare",
      "opposition", "moderaterna", "socialdemokraterna", "sd",
      "centerpartiet", "liberalerna", "kristdemokraterna", "miljöpartiet",
      "vänsterpartiet", "eu", "lagförslag", "reform", "debatt",
    ],
    weakKeywords: ["kommun", "kommunen", "region", "skatt", "budget"],
  },
  {
    id: "noje",
    label: "Nöje & kultur",
    strongKeywords: [
      "nöje", "kultur", "film", "musik", "artist", "kändis", "festival",
      "konsert", "album", "skivbolag", "tv", "serie", "premiär", "scen",
      "teater", "konst", "bok", "författare", "melodifestivalen", "eurovision",
      "hollywood", "röda mattan", "gala",
    ],
    weakKeywords: ["stjärna"],
  },
  {
    id: "teknik",
    label: "Vetenskap & teknik",
    strongKeywords: [
      "teknik", "vetenskap", "forskning", "forskare", "studie", "ai",
      "artificiell intelligens", "rymd", "rymden", "klimat", "klimatet",
      "miljö", "energi", "elpris", "innovation", "app", "internet",
      "data", "cyber", "medicin", "vaccin", "sjukdom",
    ],
    weakKeywords: ["el", "hälsa"],
  },
];

const FALLBACK_ID: CategoryId = "ovrigt";
const FALLBACK_LABEL = "Övrigt";

// Alla kategorier inkl. fallback – används för att rendera filtren.
export const ALL_CATEGORIES: { id: CategoryId; label: string }[] = [
  ...CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  { id: FALLBACK_ID, label: FALLBACK_LABEL },
];

const STRONG_WEIGHT = 3;
const WEAK_WEIGHT = 1;
const MIN_SCORE = STRONG_WEIGHT;

type CompiledCategory = {
  id: DefinedCategoryId;
  strong: RegExp[];
  weak: RegExp[];
  veto: RegExp[];
};

const COMPILED: CompiledCategory[] = CATEGORIES.map((c) => ({
  id: c.id,
  strong: compileKeywords(c.strongKeywords),
  weak: compileKeywords(c.weakKeywords ?? []),
  veto: compileKeywords(c.vetoKeywords ?? []),
}));

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileKeywords(keywords: string[]): RegExp[] {
  return keywords.map(
    (kw) =>
      new RegExp(`(?<![a-zåäöéèü])${escapeRegExp(kw)}(?![a-zåäöéèü])`, "i")
  );
}

function countMatches(res: RegExp[], haystack: string): number {
  return res.reduce((count, re) => count + (re.test(haystack) ? 1 : 0), 0);
}

function scoreCategory(cat: CompiledCategory, haystack: string): number {
  const strongMatches = countMatches(cat.strong, haystack);
  if (strongMatches === 0) return 0;

  const weakMatches = countMatches(cat.weak, haystack);
  const vetoMatches = countMatches(cat.veto, haystack);
  const weakScore = Math.max(0, weakMatches - vetoMatches) * WEAK_WEIGHT;
  const score = strongMatches * STRONG_WEIGHT + weakScore;

  return score >= MIN_SCORE ? score : 0;
}

// Returnerar kategori-id för en nyhet. Högst poäng vinner.
export function categorize(title: string, summary: string): CategoryId {
  const haystack = `${title} ${summary}`;
  let best: { id: DefinedCategoryId; score: number } | null = null;

  for (const cat of COMPILED) {
    const score = scoreCategory(cat, haystack);
    if (!best || score > best.score) {
      best = { id: cat.id, score };
    }
  }

  return best && best.score > 0 ? best.id : FALLBACK_ID;
}
