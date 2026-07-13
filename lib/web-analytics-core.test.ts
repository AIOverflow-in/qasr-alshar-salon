import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTrack, aggregatePageStats, fmtDuration, MAX_ENGAGED_SEC } from "./web-analytics-core.ts";

test("normalizeTrack strips query/hash + trailing slash, keeps bare root", () => {
  assert.deepEqual(normalizeTrack("/services/?a=1#x", 30), { path: "/services", sec: 30 });
  assert.deepEqual(normalizeTrack("/", 5), { path: "/", sec: 5 });
  assert.deepEqual(normalizeTrack("/blog/post-1/", 12), { path: "/blog/post-1", sec: 12 });
});

test("normalizeTrack rejects non-page junk", () => {
  assert.equal(normalizeTrack("not-a-path", 10), null); // must start with /
  assert.equal(normalizeTrack(123, 10), null);
  assert.equal(normalizeTrack("/" + "x".repeat(200), 10), null); // too long
  assert.equal(normalizeTrack("/ok", "abc"), null); // bad sec
  assert.equal(normalizeTrack("/ok", -3), null); // negative sec
});

test("normalizeTrack clamps engaged seconds to the cap and floors", () => {
  assert.equal(normalizeTrack("/x", 99999)!.sec, MAX_ENGAGED_SEC);
  assert.equal(normalizeTrack("/x", 45.9)!.sec, 45);
});

test("aggregatePageStats totals views + computes avg time per page", () => {
  const rows = [
    { day: "2026-07-10", path: "/services", views: 10, engagedSec: 300 },
    { day: "2026-07-11", path: "/services", views: 10, engagedSec: 500 },
    { day: "2026-07-11", path: "/", views: 30, engagedSec: 300 },
  ];
  const s = aggregatePageStats(rows);
  assert.equal(s.totalViews, 50);
  assert.equal(s.topPages[0].path, "/"); // most views first
  assert.equal(s.topPages[0].avgSec, 10); // 300/30
  const services = s.topPages.find((p) => p.path === "/services")!;
  assert.equal(services.views, 20);
  assert.equal(services.avgSec, 40); // 800/20
});

test("aggregatePageStats trend is per-day, ascending", () => {
  const rows = [
    { day: "2026-07-11", path: "/a", views: 5, engagedSec: 0 },
    { day: "2026-07-10", path: "/a", views: 3, engagedSec: 0 },
    { day: "2026-07-10", path: "/b", views: 2, engagedSec: 0 },
  ];
  const s = aggregatePageStats(rows);
  assert.deepEqual(s.byDay, [{ day: "2026-07-10", views: 5 }, { day: "2026-07-11", views: 5 }]);
});

test("aggregatePageStats respects the limit + handles empty", () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ day: "2026-07-11", path: `/p${i}`, views: i + 1, engagedSec: 0 }));
  assert.equal(aggregatePageStats(rows, { limit: 5 }).topPages.length, 5);
  const empty = aggregatePageStats([]);
  assert.deepEqual(empty, { totalViews: 0, avgSec: 0, topPages: [], byDay: [] });
});

test("fmtDuration renders compact labels", () => {
  assert.equal(fmtDuration(45), "45s");
  assert.equal(fmtDuration(60), "1m");
  assert.equal(fmtDuration(80), "1m 20s");
});
