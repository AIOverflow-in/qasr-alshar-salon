// Pure, dependency-free SEO-keyword helpers — unit-tested in keyword-core.test.ts.
// No prisma / network here so the harvest + rotation logic can be tested in isolation.

export type ParsedKeyword = {
  phrase: string;
  cluster: string;
  intent: string;
  secondary: string[];
};

export const VALID_INTENTS = ["informational", "commercial", "transactional"] as const;

// Service clusters we care about (used to route internal links + fallback imagery).
export const CLUSTERS = [
  "braids", "locs", "henna", "nails", "lashes", "waxing", "threading",
  "facial", "bridal", "makeup", "hair", "massage", "general",
] as const;

/** Normalize a search phrase: lowercase, strip quotes/edge punctuation, single-space. */
export function normalizeKeyword(phrase: string): string {
  return String(phrase || "")
    .toLowerCase()
    .replace(/["'“”‘’]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—.,:;]+|[\s\-–—.,:;]+$/g, "")
    .trim();
}

function cleanCluster(c: unknown): string {
  const v = normalizeKeyword(String(c ?? ""));
  return (CLUSTERS as readonly string[]).includes(v) ? v : "general";
}
function cleanIntent(i: unknown): string {
  const v = normalizeKeyword(String(i ?? ""));
  return (VALID_INTENTS as readonly string[]).includes(v) ? v : "informational";
}

/**
 * Parse the harvest model's JSON into clean keyword rows. Tolerant of shape
 * ({keywords:[...]} or a bare array), drops blanks/dupes, caps counts.
 */
export function parseHarvestKeywords(raw: string, cap = 25): ParsedKeyword[] {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  const arr: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { keywords?: unknown[] })?.keywords)
      ? (data as { keywords: unknown[] }).keywords
      : [];
  const seen = new Set<string>();
  const out: ParsedKeyword[] = [];
  for (const item of arr) {
    const o = (item ?? {}) as Record<string, unknown>;
    const phrase = normalizeKeyword(String(o.phrase ?? o.keyword ?? o.term ?? ""));
    if (phrase.length < 3 || phrase.length > 90 || seen.has(phrase)) continue;
    seen.add(phrase);
    const secondary = Array.isArray(o.secondary)
      ? (o.secondary as unknown[]).map((s) => normalizeKeyword(String(s))).filter((s) => s.length >= 3).slice(0, 5)
      : [];
    out.push({ phrase, cluster: cleanCluster(o.cluster), intent: cleanIntent(o.intent), secondary });
    if (out.length >= cap) break;
  }
  return out;
}

/** Keep only incoming keywords whose phrase isn't already stored (case-normalized). */
export function dedupeKeywords(existingPhrases: string[], incoming: ParsedKeyword[]): ParsedKeyword[] {
  const have = new Set(existingPhrases.map(normalizeKeyword));
  const out: ParsedKeyword[] = [];
  for (const k of incoming) {
    if (have.has(k.phrase)) continue;
    have.add(k.phrase);
    out.push(k);
  }
  return out;
}

export type SelectableKeyword = {
  phrase: string;
  cluster: string;
  intent: string;
  secondary: string[];
  timesUsed: number;
  lastUsedAt: Date | string | null;
};

/**
 * Rotation rule: pick the LEAST-used keyword — timesUsed ascending, then
 * never-used (null lastUsedAt) before stale, then oldest lastUsedAt, then phrase
 * for a stable deterministic tiebreak. This is exactly "once some keys are used,
 * move to the others / least-recently-used".
 */
export function selectKeyword<T extends SelectableKeyword>(candidates: T[]): T | null {
  if (!candidates.length) return null;
  const ts = (d: Date | string | null) => (d == null ? -1 : new Date(d).getTime());
  return [...candidates].sort((a, b) =>
    (a.timesUsed - b.timesUsed) ||
    (ts(a.lastUsedAt) - ts(b.lastUsedAt)) ||
    a.phrase.localeCompare(b.phrase),
  )[0];
}

// Cluster → a SAFE internal-link path (the /services index is always valid; we
// deep-link only clusters with known category slugs to avoid 404s).
const CLUSTER_PATH: Record<string, string> = {
  braids: "/services/braiding-styles",
  locs: "/services/braiding-styles",
  henna: "/services",
  nails: "/services/hands",
  lashes: "/services",
  waxing: "/services/body-waxing",
  threading: "/services/face-waxing",
  facial: "/services",
  bridal: "/services/qasr-glam",
  makeup: "/services/qasr-glam",
  hair: "/services/hair-styling",
  massage: "/services",
};
export function clusterToServicePath(cluster: string): string {
  return CLUSTER_PATH[normalizeKeyword(cluster)] ?? "/services";
}
