import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterServices, clusterPriceRange, clusterPriceContext } from "./service-pricing";

test("clusterServices maps a keyword cluster to real catalogue items", () => {
  const braids = clusterServices("braids");
  assert.ok(braids.length > 0);
  assert.ok(braids.some((s) => /knotless/i.test(s.name)));
  // unknown / general clusters carry no priced services
  assert.equal(clusterServices("general").length, 0);
  assert.equal(clusterServices("nonsense").length, 0);
});

test("clusterPriceRange returns real min/max inclusive prices (or null)", () => {
  const r = clusterPriceRange("braids");
  assert.ok(r && r.min > 0 && r.max >= r.min);
  // Knotless Braids is a real inclusive price (263) → must fall within range
  assert.ok(r!.min <= 263 && 263 <= r!.max);
  assert.equal(clusterPriceRange("general"), null);
});

test("clusterPriceContext quotes only genuine catalogue prices + the true range", () => {
  const ctx = clusterPriceContext("braids");
  assert.match(ctx, /AED \d+/);
  const r = clusterPriceRange("braids")!;
  assert.ok(ctx.includes(`Overall about AED ${r.min}–${r.max}`));
  assert.match(ctx, /263/); // a real inclusive braids price is present
  assert.equal(clusterPriceContext("general"), ""); // nothing to quote → empty
});

test("clusterPriceContext caps the sample yet always states the true overall range", () => {
  const r = clusterPriceRange("hair")!;
  const ctx = clusterPriceContext("hair", 5);
  assert.ok(ctx.includes(`Overall about AED ${r.min}–${r.max}`));
  const sampled = ctx.split(". Overall")[0].split(", ").length;
  assert.ok(sampled <= 5, `expected <=5 sampled items, got ${sampled}`);
});

test("a single-price cluster reads 'Around AED N', not a N–N range", () => {
  const ctx = clusterPriceContext("henna"); // henna items are all one price
  assert.match(ctx, /Around AED \d+\./);
  assert.doesNotMatch(ctx, /(\d+)–\1\b/); // never "105–105"
});

test("makeup and bridal both resolve to the Qasr Glam price area", () => {
  assert.ok(clusterServices("makeup").some((s) => /glam/i.test(s.name)));
  assert.ok(clusterPriceRange("bridal")!.max >= 2000); // bridal packages sit high
});
