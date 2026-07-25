import { test } from "node:test";
import assert from "node:assert/strict";
import { monthStartUTC, dubaiDayRange, dubaiRangeForDate, salesRange } from "./finance-core";

test("monthStartUTC resolves the Dubai month, not the UTC month (tz boundary)", () => {
  // 2026-06-30 20:30 UTC = 2026-07-01 00:30 Dubai → July → month start = Jun 30 20:00 UTC.
  assert.equal(monthStartUTC(new Date("2026-06-30T20:30:00Z")).toISOString(), "2026-06-30T20:00:00.000Z");
  // 2026-06-30 19:00 UTC = 2026-06-30 23:00 Dubai → still June → month start = May 31 20:00 UTC.
  assert.equal(monthStartUTC(new Date("2026-06-30T19:00:00Z")).toISOString(), "2026-05-31T20:00:00.000Z");
  // Mid-month sanity.
  assert.equal(monthStartUTC(new Date("2026-07-15T10:00:00Z")).toISOString(), "2026-06-30T20:00:00.000Z");
});

test("dubaiRangeForDate spans exactly one Dubai day in UTC", () => {
  const { start, end } = dubaiRangeForDate("2026-07-04");
  assert.equal(start.toISOString(), "2026-07-03T20:00:00.000Z"); // Jul 4 00:00 Dubai
  assert.equal(end.toISOString(), "2026-07-04T20:00:00.000Z");
  assert.equal(end.getTime() - start.getTime(), 86_400_000);
});

test("dubaiDayRange: 24h window, offsets shift by whole days", () => {
  const today = dubaiDayRange(0);
  assert.equal(today.end.getTime() - today.start.getTime(), 86_400_000);
  assert.equal(today.start.getUTCMinutes(), 0);
  assert.equal(dubaiDayRange(-1).start.getTime(), today.start.getTime() - 86_400_000);
});

test("salesRange precedence: from+to range wins and normalizes order", () => {
  const r = salesRange({ from: "2026-07-01", to: "2026-07-03" });
  assert.equal(r.start.getTime(), dubaiRangeForDate("2026-07-01").start.getTime());
  assert.equal(r.end.getTime(), dubaiRangeForDate("2026-07-03").end.getTime());
  // Reversed inputs produce the same normalized window.
  const swapped = salesRange({ from: "2026-07-03", to: "2026-07-01" });
  assert.equal(swapped.start.getTime(), r.start.getTime());
  assert.equal(swapped.end.getTime(), r.end.getTime());
});

test("salesRange precedence: single date, then named range, then today", () => {
  const d = salesRange({ date: "2026-07-04" });
  assert.equal(d.start.getTime(), dubaiRangeForDate("2026-07-04").start.getTime());
  // A single valid ?date wins over a malformed ?from.
  assert.equal(salesRange({ from: "nope", date: "2026-07-04" }).start.getTime(), d.start.getTime());
  // Named window.
  assert.equal(salesRange({ range: "yesterday" }).start.getTime(), dubaiDayRange(-1).start.getTime());
  // Default: today (also the fallback when only one side of a range is given).
  assert.equal(salesRange({}).start.getTime(), dubaiDayRange(0).start.getTime());
  assert.equal(salesRange({ from: "2026-07-01" }).start.getTime(), dubaiDayRange(0).start.getTime());
});
