import { test } from "node:test";
import assert from "node:assert/strict";
import { lineArtistIds, orderArtistNames } from "./artists";

test("lineArtistIds: explicit per-line artists win", () => {
  assert.deepEqual(lineArtistIds({ staffIds: ["a", "b"] }, "z"), ["a", "b"]);
});

test("lineArtistIds: falls back to the legacy single line artist", () => {
  assert.deepEqual(lineArtistIds({ staffIds: [], staffId: "a" }, "z"), ["a"]);
  assert.deepEqual(lineArtistIds({ staffIds: null, staffId: "a" }, "z"), ["a"]);
});

test("lineArtistIds: falls back to the order-level artist, else empty", () => {
  assert.deepEqual(lineArtistIds({}, "z"), ["z"]);
  assert.deepEqual(lineArtistIds({ staffId: null }, null), []);
  assert.deepEqual(lineArtistIds({}, undefined), []);
});

test("orderArtistNames: distinct names in first-seen order", () => {
  const names = new Map([["a", "Ana"], ["b", "Bea"], ["c", "Cara"]]);
  const lines = [{ staffIds: ["a", "b"] }, { staffId: "a" }, { staffIds: ["c"] }];
  assert.deepEqual(orderArtistNames(lines, "z", (id) => names.get(id)), ["Ana", "Bea", "Cara"]);
});

test("orderArtistNames: unknown ids (no name) are skipped", () => {
  const names = new Map([["a", "Ana"], ["b", "Bea"]]);
  const lines = [{ staffIds: ["a"] }, { staffIds: ["c"] }]; // c has no name
  assert.deepEqual(orderArtistNames(lines, "z", (id) => names.get(id)), ["Ana"]);
});

test("orderArtistNames: uses the order artist when a line has none", () => {
  const names = new Map([["z", "Zoe"]]);
  assert.deepEqual(orderArtistNames([{}], "z", (id) => names.get(id)), ["Zoe"]);
  assert.deepEqual(orderArtistNames([], "z", (id) => names.get(id)), []);
});
