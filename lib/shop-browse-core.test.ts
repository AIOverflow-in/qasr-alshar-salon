import { test } from "node:test";
import assert from "node:assert/strict";
import { categoriesOf, filterProducts, pageSlice } from "./shop-browse-core.ts";

const P = [
  { name: "Brazilian Bundle 18\"", category: "Hair Extensions", description: "Straight human hair" },
  { name: "Argan Oil Serum", category: "Aftercare", description: "Repairs dry ends" },
  { name: "Edge Control", category: "Aftercare", description: null },
  { name: "Closure 4x4", category: "Hair Extensions", description: "HD lace" },
];

test("categoriesOf returns distinct, sorted, non-empty categories", () => {
  assert.deepEqual(categoriesOf(P), ["Aftercare", "Hair Extensions"]);
  assert.deepEqual(categoriesOf([{ name: "x", category: "" }, { name: "y", category: "  " }]), []);
});

test("filterProducts matches name/category/description, case-insensitive", () => {
  assert.equal(filterProducts(P, "argan", "all").length, 1);
  assert.equal(filterProducts(P, "hair", "all").length, 2);   // matches category "Hair Extensions"
  assert.equal(filterProducts(P, "dry ends", "all").length, 1); // description match
  assert.equal(filterProducts(P, "", "all").length, 4);        // empty query → all
});

test("filterProducts respects the category filter and combines with query", () => {
  assert.equal(filterProducts(P, "", "Aftercare").length, 2);
  assert.equal(filterProducts(P, "oil", "Aftercare").length, 1);
  assert.equal(filterProducts(P, "oil", "Hair Extensions").length, 0); // query in wrong category
});

test("pageSlice clamps the page and returns the right window", () => {
  const items = Array.from({ length: 25 }, (_, i) => i);
  const p1 = pageSlice(items, 1, 12);
  assert.deepEqual([p1.page, p1.pageCount, p1.items.length], [1, 3, 12]);
  const p3 = pageSlice(items, 3, 12);
  assert.deepEqual([p3.page, p3.pageCount, p3.items], [3, 3, [24]]);
  // out-of-range page clamps into range
  assert.equal(pageSlice(items, 99, 12).page, 3);
  assert.equal(pageSlice(items, 0, 12).page, 1);
  // empty list → one page
  assert.deepEqual(pageSlice([], 1, 12), { items: [], page: 1, pageCount: 1 });
});
