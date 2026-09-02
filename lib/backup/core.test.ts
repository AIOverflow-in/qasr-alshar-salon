import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRetention, backupKey, dubaiDay, jsonReplacer, jsonReviver } from "./core.ts";

test("backups are named by the Dubai day, not UTC", () => {
  // 23:30 UTC on the 30th is already the 31st in Dubai (UTC+4). A UTC-named backup would
  // overwrite the previous day's file.
  assert.equal(dubaiDay(new Date("2026-08-30T23:30:00Z")), "2026-08-31");
  assert.equal(dubaiDay(new Date("2026-08-31T05:00:00Z")), "2026-08-31");
});

test("keys sort chronologically as plain strings", () => {
  const keys = ["2026-09-01", "2026-08-31", "2026-12-01"].map(backupKey);
  assert.deepEqual([...keys].sort(), [backupKey("2026-08-31"), backupKey("2026-09-01"), backupKey("2026-12-01")]);
});

test("Prisma types survive a round trip", () => {
  const original = { n: 42n, when: new Date("2026-08-31T10:00:00Z"), buf: new Uint8Array([1, 2, 3]), plain: "hi" };
  const back = JSON.parse(JSON.stringify(original, jsonReplacer), jsonReviver);
  assert.equal(back.n, 42n, "BigInt would otherwise throw on stringify");
  assert.equal(back.when.getTime(), original.when.getTime());
  assert.deepEqual([...back.buf], [1, 2, 3]);
  assert.equal(back.plain, "hi");
});

test("retention keeps 8 weeks plus one per month", () => {
  const keys: string[] = [];
  for (let i = 0; i < 400; i++) {
    const d = new Date("2026-08-31T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(backupKey(d.toISOString().slice(0, 10)));
  }
  const { keep, drop } = applyRetention(keys, "2026-08-31");
  assert.ok(keep.includes(backupKey("2026-08-31")), "today must always survive");
  assert.ok(keep.includes(backupKey("2026-07-20")), "inside the 56-day window (8 weekly runs)");
  assert.ok(drop.includes(backupKey("2026-06-15")), "an old mid-month daily is dropped");
  assert.ok(keep.length > 56 && keep.length < 75, `expected ~68 kept, got ${keep.length}`);
  assert.equal(keep.length + drop.length, keys.length, "every backup is either kept or dropped");
});

test("retention never drops everything if dates are unparseable", () => {
  const { keep, drop } = applyRetention(["db-backups/garbage.gz"], "2026-08-31");
  assert.deepEqual(keep, []);
  assert.deepEqual(drop, [], "an unrecognised name is left alone rather than deleted");
});
