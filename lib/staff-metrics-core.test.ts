import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStaffMetrics, type MetricLine } from "./staff-metrics-core";

const L = (lineAED: number, iso: string, clientKey: string, description = "Braids", artistCount = 1): MetricLine =>
  ({ lineAED, createdAt: new Date(iso), clientKey, description, artistCount });

test("revenue, visits and per-visit average", () => {
  const m = buildStaffMetrics([L(300, "2026-07-02T09:00:00Z", "c1"), L(500, "2026-07-10T09:00:00Z", "c2")], ["2026-07"]);
  assert.equal(m.revenueAED, 800);
  assert.equal(m.visits, 2);
  assert.equal(m.avgPerVisitAED, 400);
});

test("a shared service is split equally — matches how commission is paid", () => {
  const m = buildStaffMetrics([L(600, "2026-07-02T09:00:00Z", "c1", "Braids", 2)], ["2026-07"]);
  assert.equal(m.revenueAED, 300);
});

test("repeat clients and repeat rate", () => {
  const m = buildStaffMetrics([
    L(100, "2026-07-01T09:00:00Z", "c1"), L(100, "2026-07-15T09:00:00Z", "c1"), // same client twice
    L(100, "2026-07-03T09:00:00Z", "c2"),
  ], ["2026-07"]);
  assert.equal(m.clients, 2);
  assert.equal(m.repeatClients, 1);
  assert.equal(m.repeatRatePct, 50);
  assert.equal(m.avgPerClientAED, 150); // 300 / 2 clients
});

test("trend covers every requested month, quiet ones included as zero", () => {
  const m = buildStaffMetrics([L(400, "2026-07-05T09:00:00Z", "c1")], ["2026-05", "2026-06", "2026-07"]);
  assert.deepEqual(m.trend.map((t) => t.revenueAED), [0, 0, 400]);
  assert.deepEqual(m.trend.map((t) => t.label), ["May", "Jun", "Jul"]);
});

test("top services ranked by revenue", () => {
  const m = buildStaffMetrics([
    L(100, "2026-07-01T09:00:00Z", "c1", "Nails"),
    L(500, "2026-07-02T09:00:00Z", "c2", "Braids"),
    L(200, "2026-07-03T09:00:00Z", "c3", "Braids"),
  ], ["2026-07"]);
  assert.equal(m.topServices[0].name, "Braids");
  assert.equal(m.topServices[0].times, 2);
  assert.equal(m.topServices[0].revenueAED, 700);
});

test("empty history is safe (no divide-by-zero)", () => {
  const m = buildStaffMetrics([], ["2026-07"]);
  assert.equal(m.revenueAED, 0);
  assert.equal(m.avgPerClientAED, 0);
  assert.equal(m.repeatRatePct, 0);
  assert.equal(m.busiestDay, null);
  assert.equal(m.trend.length, 1);
});
