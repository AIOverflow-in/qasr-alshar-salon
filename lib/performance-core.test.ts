import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPerformance } from "./performance-core";

const S = (name: string, grossAED: number, clientsServed: number, active = true) =>
  ({ staffId: name, name, role: "Crown Artist", active, grossAED, clientsServed });

test("ranks by revenue and computes share + per-client", () => {
  const r = buildPerformance([S("Amina", 6000, 20), S("Stephen", 2000, 10), S("Ruth", 4000, 10)]);
  assert.deepEqual(r.rows.map((x) => x.name), ["Amina", "Ruth", "Stephen"]);
  assert.equal(r.rows[0].rank, 1);
  assert.equal(r.totalRevenueAED, 12000);
  assert.equal(r.rows[0].sharePct, 50);          // 6000 / 12000
  assert.equal(r.rows[0].perClientAED, 300);     // 6000 / 20
  assert.equal(r.rows[2].perClientAED, 200);     // Stephen: 2000 / 10
});

test("vs-average shows who is behind (the reason this exists)", () => {
  const r = buildPerformance([S("Amina", 6000, 20), S("Stephen", 2000, 10), S("Ruth", 4000, 10)]);
  assert.equal(r.averageRevenueAED, 4000);
  assert.equal(r.rows.find((x) => x.name === "Stephen")!.vsAveragePct, -50); // half the team average
  assert.equal(r.rows.find((x) => x.name === "Amina")!.vsAveragePct, 50);
});

test("inactive staff and zero-activity staff are left out", () => {
  const r = buildPerformance([S("Amina", 6000, 20), S("Gone", 5000, 5, false), S("Idle", 0, 0)]);
  assert.deepEqual(r.rows.map((x) => x.name), ["Amina"]);
  assert.equal(r.activeCount, 1);
});

test("empty month doesn't divide by zero", () => {
  const r = buildPerformance([]);
  assert.deepEqual(r.rows, []);
  assert.equal(r.averageRevenueAED, 0);
  assert.equal(r.totalRevenueAED, 0);
});

test("someone with clients but no revenue still appears, with no divide-by-zero", () => {
  const r = buildPerformance([S("New", 0, 3)]);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].perClientAED, 0);
  assert.equal(r.rows[0].sharePct, 0);
});
