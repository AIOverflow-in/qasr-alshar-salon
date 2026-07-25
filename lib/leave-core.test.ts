import { test } from "node:test";
import assert from "node:assert/strict";
import { inclusiveDays, leaveSummary, overlapsPeak, ANNUAL_LEAVE_DAYS } from "./leave-core";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

test("inclusiveDays counts both endpoints (one-day leave = 1)", () => {
  assert.equal(inclusiveDays(utc(2026, 7, 1), utc(2026, 7, 1)), 1);
  assert.equal(inclusiveDays(utc(2026, 7, 1), utc(2026, 7, 5)), 5);
  assert.equal(inclusiveDays(utc(2026, 7, 1), utc(2026, 7, 31)), 31);
  assert.equal(inclusiveDays(utc(2026, 7, 5), utc(2026, 7, 1)), 1); // reversed → floor of 1
});

test("leaveSummary: not eligible before 12 months of service", () => {
  const s = leaveSummary(utc(2026, 1, 1), [], utc(2026, 7, 25)); // ~6 months
  assert.deepEqual(s, { eligible: false, entitlement: 0, taken: 0, remaining: 0 });
});

test("leaveSummary: no join date → never eligible", () => {
  assert.equal(leaveSummary(null, [], utc(2026, 7, 25)).eligible, false);
  assert.equal(leaveSummary(undefined, [], utc(2026, 7, 25)).entitlement, 0);
});

test("leaveSummary: 12-month boundary is exact", () => {
  // Joined exactly one day short of 12 months → not eligible.
  assert.equal(leaveSummary(utc(2025, 7, 26), [], utc(2026, 7, 25)).eligible, false);
  // Joined exactly 12 months ago → eligible.
  assert.equal(leaveSummary(utc(2025, 7, 25), [], utc(2026, 7, 25)).eligible, true);
});

test("leaveSummary: counts only ANNUAL leave in the current year", () => {
  const leaves = [
    { startDate: utc(2026, 2, 10), endDate: utc(2026, 2, 14), days: 5, type: "ANNUAL" },
    { startDate: utc(2026, 3, 1), endDate: utc(2026, 3, 3), days: 3, type: "SICK" },    // wrong type
    { startDate: utc(2025, 6, 1), endDate: utc(2025, 6, 7), days: 7, type: "ANNUAL" },  // wrong year
  ];
  const s = leaveSummary(utc(2024, 1, 1), leaves, utc(2026, 7, 25));
  assert.deepEqual(s, { eligible: true, entitlement: ANNUAL_LEAVE_DAYS, taken: 5, remaining: 16 });
});

test("leaveSummary: remaining never goes negative", () => {
  const leaves = [{ startDate: utc(2026, 2, 1), endDate: utc(2026, 3, 5), days: 25, type: "ANNUAL" }];
  const s = leaveSummary(utc(2024, 1, 1), leaves, utc(2026, 7, 25));
  assert.equal(s.taken, 25);
  assert.equal(s.remaining, 0); // 21 − 25 clamped to 0
});

test("overlapsPeak flags any December day in the range", () => {
  assert.equal(overlapsPeak(utc(2026, 12, 10), utc(2026, 12, 20)), true);
  assert.equal(overlapsPeak(utc(2026, 12, 25), utc(2026, 12, 25)), true);
  assert.equal(overlapsPeak(utc(2026, 11, 28), utc(2026, 12, 3)), true); // crosses into Dec
  assert.equal(overlapsPeak(utc(2026, 7, 1), utc(2026, 7, 10)), false);
});
