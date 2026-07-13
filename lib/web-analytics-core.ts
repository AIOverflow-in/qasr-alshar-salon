// Pure, dependency-free web-analytics helpers — unit-tested in
// web-analytics-core.test.ts. No prisma/network so the beacon validation and the
// dashboard aggregation can be tested in isolation and reused on both sides.

/** Longest engaged time we credit to a single page visit (10 min) — clamps outliers/abuse. */
export const MAX_ENGAGED_SEC = 600;
const MAX_PATH_LEN = 120;

export type TrackInput = { path: string; sec: number };

/**
 * Validate + normalize a raw beacon payload. Returns a clean {path, sec} or null
 * when the payload isn't a real page hit (so junk never reaches the DB).
 * - path: must be an absolute in-site path; query/hash stripped; length-capped.
 * - sec: coerced to an integer and clamped to 0..MAX_ENGAGED_SEC.
 */
export function normalizeTrack(rawPath: unknown, rawSec: unknown): TrackInput | null {
  if (typeof rawPath !== "string") return null;
  let path = rawPath.trim();
  if (!path.startsWith("/")) return null;
  path = path.split(/[?#]/)[0]; // drop query + hash
  if (path.length > 1) path = path.replace(/\/+$/, ""); // strip trailing slash (keep bare "/")
  if (!path || path.length > MAX_PATH_LEN) return null;

  const n = Number(rawSec);
  if (!Number.isFinite(n) || n < 0) return null;
  const sec = Math.min(MAX_ENGAGED_SEC, Math.floor(n));
  return { path, sec };
}

export type PageStatRow = { day: string; path: string; views: number; engagedSec: number };
export type PageSummary = { path: string; views: number; avgSec: number };
export type AnalyticsSummary = {
  totalViews: number;
  avgSec: number;
  topPages: PageSummary[];
  byDay: { day: string; views: number }[];
};

/**
 * Fold raw daily rollup rows into a dashboard summary: per-path totals with
 * average time-on-page, plus a per-day view trend.
 */
export function aggregatePageStats(rows: PageStatRow[], opts: { limit?: number } = {}): AnalyticsSummary {
  const limit = opts.limit ?? 20;
  const byPath = new Map<string, { views: number; engagedSec: number }>();
  const byDay = new Map<string, number>();
  let totalViews = 0;
  let totalEngaged = 0;

  for (const r of rows) {
    const views = Math.max(0, r.views | 0);
    const eng = Math.max(0, r.engagedSec | 0);
    const p = byPath.get(r.path) ?? { views: 0, engagedSec: 0 };
    p.views += views;
    p.engagedSec += eng;
    byPath.set(r.path, p);
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + views);
    totalViews += views;
    totalEngaged += eng;
  }

  const topPages: PageSummary[] = [...byPath.entries()]
    .map(([path, v]) => ({ path, views: v.views, avgSec: v.views ? Math.round(v.engagedSec / v.views) : 0 }))
    .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
    .slice(0, limit);

  const trend = [...byDay.entries()]
    .map(([day, views]) => ({ day, views }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    totalViews,
    avgSec: totalViews ? Math.round(totalEngaged / totalViews) : 0,
    topPages,
    byDay: trend,
  };
}

/** Format seconds as a compact "1m 20s" / "45s" label for the dashboard. */
export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}
