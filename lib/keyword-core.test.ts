import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeKeyword, parseHarvestKeywords, dedupeKeywords, selectKeyword, clusterToServicePath,
} from "./keyword-core.ts";

test("normalizeKeyword lowercases, strips quotes/edge punctuation, collapses spaces", () => {
  assert.equal(normalizeKeyword('  "Knotless   Braids Dubai" '), "knotless braids dubai");
  assert.equal(normalizeKeyword("Bridal Henna — "), "bridal henna");
  assert.equal(normalizeKeyword("HAIR   BOTOX"), "hair botox");
});

test("parseHarvestKeywords accepts {keywords:[…]} or a bare array, cleans + caps", () => {
  const raw = JSON.stringify({ keywords: [
    { phrase: "Knotless Braids Dubai price", cluster: "Braids", intent: "commercial", secondary: ["box braids dubai"] },
    { keyword: "loc retwist near me", cluster: "locs", intent: "transactional" },
    { term: "x", cluster: "hair", intent: "informational" }, // too short → dropped
    { phrase: "Knotless braids dubai PRICE" }, // dup of #1 after normalize → dropped
  ] });
  const out = parseHarvestKeywords(raw);
  assert.equal(out.length, 2);
  assert.equal(out[0].phrase, "knotless braids dubai price");
  assert.equal(out[0].cluster, "braids");
  assert.equal(out[0].intent, "commercial");
  assert.deepEqual(out[0].secondary, ["box braids dubai"]);
  assert.equal(out[1].intent, "transactional");
});

test("parseHarvestKeywords is safe on junk / unknown cluster+intent", () => {
  assert.deepEqual(parseHarvestKeywords("not json"), []);
  const out = parseHarvestKeywords(JSON.stringify([{ phrase: "some salon term", cluster: "zzz", intent: "buy" }]));
  assert.equal(out[0].cluster, "general");
  assert.equal(out[0].intent, "informational");
});

test("dedupeKeywords removes phrases already stored (normalized) + within-batch dups", () => {
  const existing = ["Knotless Braids Dubai"];
  const incoming = parseHarvestKeywords(JSON.stringify([
    { phrase: "knotless braids dubai" },   // already stored
    { phrase: "silk press dubai" },        // new
    { phrase: "Silk Press Dubai" },        // dup within batch
  ]));
  const fresh = dedupeKeywords(existing, incoming);
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].phrase, "silk press dubai");
});

test("selectKeyword picks least-used → never-used → oldest → stable", () => {
  const now = new Date("2026-07-01T00:00:00Z");
  const older = new Date("2026-06-01T00:00:00Z");
  const rows = [
    { phrase: "b", cluster: "hair", intent: "informational", secondary: [], timesUsed: 2, lastUsedAt: older },
    { phrase: "a-neverused", cluster: "hair", intent: "informational", secondary: [], timesUsed: 0, lastUsedAt: null },
    { phrase: "c", cluster: "hair", intent: "informational", secondary: [], timesUsed: 1, lastUsedAt: now },
  ];
  assert.equal(selectKeyword(rows)?.phrase, "a-neverused"); // timesUsed 0 wins
  assert.equal(selectKeyword([]), null);
  // tie on timesUsed → null lastUsedAt first
  const tie = [
    { phrase: "used-recently", cluster: "hair", intent: "informational", secondary: [], timesUsed: 1, lastUsedAt: now },
    { phrase: "used-older", cluster: "hair", intent: "informational", secondary: [], timesUsed: 1, lastUsedAt: older },
  ];
  assert.equal(selectKeyword(tie)?.phrase, "used-older");
});

test("clusterToServicePath maps known clusters and never returns an unknown path", () => {
  assert.equal(clusterToServicePath("braids"), "/services/braiding-styles");
  assert.equal(clusterToServicePath("nails"), "/services/hands");
  assert.equal(clusterToServicePath("zzz"), "/services"); // safe fallback (no 404)
});
