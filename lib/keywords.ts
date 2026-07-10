import "server-only";
import { prisma } from "./prisma";
import { getResearchProvider, getTextProvider } from "./ai";
import { parseHarvestKeywords, dedupeKeywords, selectKeyword, type ParsedKeyword } from "./keyword-core";

// Bootstrap seeds so the writer always has keywords, even before the first
// harvest or if web-search + the model both fail. Kept small + evergreen.
const SEED: ParsedKeyword[] = [
  { phrase: "knotless braids dubai", cluster: "braids", intent: "commercial", secondary: ["box braids dubai", "african hair salon dubai"] },
  { phrase: "loc retwist dubai", cluster: "locs", intent: "commercial", secondary: ["microlocs dubai", "sisterlocks dubai"] },
  { phrase: "bridal henna dubai", cluster: "henna", intent: "commercial", secondary: ["arabic henna design", "wedding henna"] },
  { phrase: "keratin treatment dubai", cluster: "hair", intent: "commercial", secondary: ["brazilian blowout dubai", "hair botox dubai"] },
  { phrase: "how to maintain box braids", cluster: "braids", intent: "informational", secondary: ["protective styles", "edge care"] },
  { phrase: "russian lashes dubai", cluster: "lashes", intent: "commercial", secondary: ["lash extensions dubai", "hybrid lashes"] },
  { phrase: "hydrafacial dubai", cluster: "facial", intent: "commercial", secondary: ["facial for oily skin", "glow facial dubai"] },
  { phrase: "gel nails dubai", cluster: "nails", intent: "commercial", secondary: ["polygel dubai", "manicure near union metro"] },
];

const RESEARCH_PROMPT = `Research what people in the UAE — especially Dubai — are currently searching for about ladies' salon and beauty services: braids, locs, henna, nails, lashes, facials, makeup, waxing, threading, and massage. Give extra weight to the multicultural / African-hair niche (knotless braids, cornrows, silk press, locs, weaves). List the actual search queries people type — autocomplete-style — including "price", "near me", "best … in Dubai", and "how to" variants. Return a plain list of real queries.`;

function distillPrompt(findings: string): string {
  const src = findings.trim()
    ? `Here are current UAE salon search findings:\n\n${findings.slice(0, 6000)}\n\nExtract the SEO keywords from these.`
    : `(No live findings available — use your own knowledge of UAE/Dubai salon search demand.)`;
  return `${src}

Return up to 20 DISTINCT high-intent SEO keyword phrases for a Dubai multicultural salon blog. Prefer informational and commercial-investigation queries (good for blog articles) over pure "book now" transactional ones. Return ONLY JSON:
{"keywords":[{"phrase": "lowercase search query","cluster":"one of: braids|locs|henna|nails|lashes|waxing|threading|facial|bridal|makeup|hair|massage|general","intent":"informational|commercial|transactional","secondary":["2-4 related long-tail terms"]}]}`;
}

/**
 * Daily keyword harvest: web-search (best-effort) → distil to structured keywords
 * → dedupe against the store → insert new ones. Falls back to model-knowledge,
 * then to the SEED list, so the store is never left empty. Returns a summary.
 */
export async function harvestKeywords() {
  const research = getResearchProvider();
  const text = getTextProvider();

  let findings = "";
  if (research) {
    try { findings = await research.webResearch(RESEARCH_PROMPT, { timeoutMs: 40_000 }); }
    catch (e) { console.error("[keywords] research error:", e); }
  }

  let parsed: ParsedKeyword[] = [];
  if (text) {
    try {
      const raw = await text.generateJSON(
        [
          { role: "system", content: "You are an SEO strategist for a Dubai multicultural ladies' salon. Output strict JSON only." },
          { role: "user", content: distillPrompt(findings) },
        ],
        { temperature: 0.4 },
      );
      parsed = parseHarvestKeywords(raw);
    } catch (e) { console.error("[keywords] distil error:", e); }
  }

  const source = parsed.length ? (findings.trim() ? "web-search" : "model") : "seed";
  if (!parsed.length) parsed = SEED;

  const existing = (await prisma.keyword.findMany({ select: { phrase: true } })).map((k) => k.phrase);
  const fresh = dedupeKeywords(existing, parsed);
  if (fresh.length) {
    await prisma.keyword.createMany({
      data: fresh.map((k) => ({ phrase: k.phrase, cluster: k.cluster, intent: k.intent, secondary: k.secondary, source })),
      skipDuplicates: true,
    });
  }
  const total = await prisma.keyword.count();
  console.log(`[keywords] harvest: source=${source} found=${parsed.length} inserted=${fresh.length} total=${total}`);
  return { source, found: parsed.length, inserted: fresh.length, total };
}

/** Ensure the store has at least the seed keywords (used before the first post if harvest hasn't run). */
export async function ensureSeeded() {
  if ((await prisma.keyword.count()) > 0) return;
  const existing: string[] = [];
  const fresh = dedupeKeywords(existing, SEED);
  await prisma.keyword.createMany({
    data: fresh.map((k) => ({ phrase: k.phrase, cluster: k.cluster, intent: k.intent, secondary: k.secondary, source: "seed" })),
    skipDuplicates: true,
  });
}

/** Pick the next keyword to write about (least-used rotation), or null if the store is empty. */
export async function selectNextKeyword() {
  const candidates = await prisma.keyword.findMany({
    orderBy: [{ timesUsed: "asc" }, { lastUsedAt: { sort: "asc", nulls: "first" } }],
    take: 50,
  });
  return selectKeyword(candidates);
}

/** Mark a keyword used after a post is written (drives rotation to the next ones). */
export async function markKeywordUsed(phrase: string) {
  await prisma.keyword.updateMany({
    where: { phrase },
    data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() },
  });
}
