// Pure, dependency-free pricing helpers derived from the service catalogue
// (lib/services.ts — the SAME source the public /services pages render, and the
// source synced to the DB). Unit-tested in service-pricing.test.ts. Their job is
// to ground the AI blog writer in REAL, VAT-inclusive prices so posts quote
// accurate ranges for the service they discuss instead of inventing figures.
import { CATEGORIES, type ServiceItem } from "./services";
import { normalizeKeyword } from "./keyword-core";

// A keyword "cluster" (see keyword-core CLUSTERS) → the catalogue category slugs
// that make up that service area. Kept here, not in keyword-core, because it
// depends on the catalogue's category slugs. "general" (and anything unknown)
// intentionally maps to nothing → no price context.
const CLUSTER_CATEGORIES: Record<string, string[]> = {
  braids: ["cornrow-styles", "braiding-styles"],
  locs: ["locks"],
  henna: ["henna"],
  nails: ["hands", "podology"],
  lashes: ["lashes"],
  waxing: ["body-waxing"],
  threading: ["face-waxing"],
  facial: ["facials"],
  bridal: ["qasr-glam"],
  makeup: ["qasr-glam"],
  hair: ["hair-styling", "haircut", "hairstyling-caucasian", "hair-coloring", "hair-treatment", "weaving"],
  massage: ["massage"],
};

/** All catalogue items that belong to a keyword cluster (empty for unknown/general). */
export function clusterServices(cluster: string): ServiceItem[] {
  const slugs = CLUSTER_CATEGORIES[normalizeKeyword(cluster)] ?? [];
  if (!slugs.length) return [];
  return CATEGORIES.filter((c) => slugs.includes(c.slug)).flatMap((c) => c.items);
}

/** Min/max VAT-inclusive price across a cluster's services, or null if none. */
export function clusterPriceRange(cluster: string): { min: number; max: number } | null {
  const prices = clusterServices(cluster).map((i) => i.price);
  if (!prices.length) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Evenly-spaced sample across a sorted list, always keeping both ends. */
function spread<T>(sorted: T[], n: number): T[] {
  if (sorted.length <= n) return sorted;
  const out: T[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (sorted.length - 1)) / (n - 1));
    if (!seen.has(idx)) { seen.add(idx); out.push(sorted[idx]); }
  }
  return out;
}

/**
 * A short, human-readable price brief to ground the blog writer: a spread of
 * representative real services with their VAT-inclusive prices plus the overall
 * range, so the model can quote an accurate range for whatever it writes about
 * and never invents a figure. Returns "" when we have no priced services for the
 * cluster (the writer then simply omits specific prices).
 */
export function clusterPriceContext(cluster: string, maxItems = 7): string {
  const items = clusterServices(cluster);
  if (!items.length) return "";
  // de-dup by name, then sort by price so the sample spans the real range
  const byName = new Map<string, ServiceItem>();
  for (const it of items) if (!byName.has(it.name)) byName.set(it.name, it);
  const sorted = [...byName.values()].sort((a, b) => a.price - b.price);
  const sample = spread(sorted, maxItems)
    .map((i) => `${i.name} AED ${i.price}${i.plus ? "+" : ""}`)
    .join(", ");
  const min = sorted[0].price;
  const max = sorted[sorted.length - 1].price;
  const summary = min === max ? `Around AED ${min}.` : `Overall about AED ${min}–${max}.`;
  return `${sample}. ${summary}`;
}
