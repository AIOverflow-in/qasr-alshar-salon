import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePage, pageWindow, DEFAULT_PAGE_SIZE } from "./pagination-core.ts";

test("parsePage: valid, invalid, arrays, out-of-range", () => {
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage(undefined), 1);
  assert.equal(parsePage("0"), 1);
  assert.equal(parsePage("-5"), 1);
  assert.equal(parsePage("abc"), 1);
  assert.equal(parsePage(["2", "9"]), 2);
  assert.equal(parsePage("4.7"), 4);
});

test("pageWindow: middle page skip/take/from/to", () => {
  const w = pageWindow(100, 3, 20);
  assert.equal(w.pages, 5);
  assert.equal(w.page, 3);
  assert.equal(w.skip, 40);
  assert.equal(w.take, 20);
  assert.equal(w.from, 41);
  assert.equal(w.to, 60);
});

test("pageWindow: last partial page", () => {
  const w = pageWindow(45, 3, 20);
  assert.equal(w.pages, 3);
  assert.equal(w.from, 41);
  assert.equal(w.to, 45);
});

test("pageWindow: clamps an over-range page to the last page (never blank)", () => {
  const w = pageWindow(45, 99, 20);
  assert.equal(w.page, 3);
  assert.equal(w.skip, 40);
});

test("pageWindow: empty set → 1 page, from/to 0, skip 0", () => {
  const w = pageWindow(0, 1, 20);
  assert.equal(w.pages, 1);
  assert.equal(w.from, 0);
  assert.equal(w.to, 0);
  assert.equal(w.skip, 0);
});

test("pageWindow: exact multiple of size", () => {
  const w = pageWindow(40, 2, 20);
  assert.equal(w.pages, 2);
  assert.equal(w.from, 21);
  assert.equal(w.to, 40);
});

test("pageWindow: bad inputs fall back safely", () => {
  const w = pageWindow(-3, 0, 0);
  assert.equal(w.total, 0);
  assert.equal(w.size, DEFAULT_PAGE_SIZE);
  assert.equal(w.page, 1);
  assert.equal(w.skip, 0);
});
