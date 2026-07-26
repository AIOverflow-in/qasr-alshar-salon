import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryWeight, styleScore, popularityScore, rankProducts, assignBadges } from "./shop-rank";

const P = (over) => ({ name: "X", category: "Wigs", description: "", unitsSold: 0, stock: 5, ...over });

test("categoryWeight: hero wigs outrank extensions, which outrank accessories", () => {
  assert.ok(categoryWeight("Lace Front Wigs") > categoryWeight("Hair Extensions"));
  assert.ok(categoryWeight("Hair Extensions") > categoryWeight("Accessories"));
  assert.equal(categoryWeight("Something Else"), 25); // unknown sits mid-pack
});

test("styleScore: in-demand textures beat specialty shades", () => {
  assert.ok(styleScore("Body Wave lace wig") > styleScore("Ginger ombre wig"));
  assert.ok(styleScore("Straight black wig") >= 6);
  assert.equal(styleScore(""), 0);
});

test("popularityScore: a single real sale outranks any heuristic advantage", () => {
  const sold = P({ category: "Accessories", name: "Edge gel", unitsSold: 1 }); // weakest heuristic, but sold
  const unsold = P({ category: "Lace Front Wigs", name: "Body Wave", unitsSold: 0 }); // strongest heuristic, unsold
  assert.ok(popularityScore(sold) > popularityScore(unsold));
});

test("rankProducts: best-selling first, then market demand, sold-out last", () => {
  const items = [
    P({ name: "Ada", category: "Wigs", description: "ginger ombre", unitsSold: 0 }),      // specialty, unsold
    P({ name: "Zoe", category: "Wigs", description: "body wave black", unitsSold: 0 }),    // popular style, unsold
    P({ name: "Top", category: "Accessories", description: "edge", unitsSold: 9 }),        // real bestseller
    P({ name: "Gone", category: "Wigs", description: "body wave", unitsSold: 3, stock: 0 }), // sold but OUT of stock
  ];
  const order = rankProducts(items).map((p) => p.name);
  assert.equal(order[0], "Top");   // real sales win
  assert.equal(order[1], "Zoe");   // popular style beats specialty
  assert.equal(order[2], "Ada");
  assert.equal(order[3], "Gone");  // out of stock sinks to the bottom despite sales
});

test("rankProducts is pure (does not mutate input)", () => {
  const items = [P({ name: "B" }), P({ name: "A" })];
  const copy = [...items];
  rankProducts(items);
  assert.deepEqual(items, copy);
});

test("assignBadges: real sellers get Bestseller (capped at 8)", () => {
  const ranked = Array.from({ length: 10 }, (_, i) => P({ name: `S${i}`, unitsSold: 10 - i }));
  const badged = assignBadges(ranked);
  assert.equal(badged.filter((p) => p.badge === "bestseller").length, 8); // capped
  assert.equal(badged[0].badge, "bestseller");
  assert.equal(badged[9].badge, null); // 9th+ real seller gets no badge
});

test("assignBadges: with no sales, top in-demand picks get Popular", () => {
  const ranked = rankProducts([
    P({ name: "A", category: "Wigs", description: "body wave" }),
    P({ name: "B", category: "Wigs", description: "straight black" }),
    P({ name: "C", category: "Accessories", description: "edge gel" }), // low demand → no Popular
  ]);
  const badged = assignBadges(ranked);
  const popular = badged.filter((p) => p.badge === "popular").map((p) => p.name).sort();
  assert.deepEqual(popular, ["A", "B"]);        // the two in-demand wigs
  assert.equal(badged.find((p) => p.name === "C").badge, null); // edge gel isn't labelled "popular"
});

test("assignBadges: bestseller wins over popular on the same card", () => {
  const ranked = rankProducts([P({ name: "Hot", category: "Wigs", description: "body wave", unitsSold: 5 })]);
  assert.equal(assignBadges(ranked)[0].badge, "bestseller");
});
