import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, allServices, getCategory } from "./services.ts";
import { slugify } from "./utils.ts";

test("category slugs are unique and non-empty", () => {
  const slugs = CATEGORIES.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length, "duplicate category slug");
  for (const s of slugs) assert.match(s, /^[a-z0-9-]+$/);
});

test("every service produces a unique DB slug (matches seed/sync keying)", () => {
  const slugs = CATEGORIES.flatMap((c) => c.items.map((i) => slugify(`${c.slug}-${i.name}`)));
  const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  assert.deepEqual(dupes, [], `duplicate service slugs: ${dupes.join(", ")}`);
});

test("prices are positive integers and durations are sane", () => {
  for (const s of allServices()) {
    assert.ok(Number.isInteger(s.price) && s.price > 0, `bad price for ${s.name}: ${s.price}`);
    assert.ok(Number.isInteger(s.duration) && s.duration >= 10 && s.duration <= 480, `bad duration for ${s.name}: ${s.duration}`);
  }
});

test("kept categories survive the menu refresh", () => {
  for (const slug of ["weaving", "facials", "lashes", "henna", "massage"]) {
    assert.ok(getCategory(slug), `expected kept category "${slug}" to still exist`);
  }
});

test("new premium categories are present", () => {
  for (const slug of ["cornrow-styles", "braiding-styles", "locks", "qasr-glam", "hands", "podology", "hair-treatment", "hair-coloring", "face-waxing", "body-waxing"]) {
    assert.ok(getCategory(slug), `expected new category "${slug}"`);
  }
});

test("ranged items ('from' price) carry a clarifying note", () => {
  for (const s of allServices()) {
    if (s.plus) assert.ok(s.note && s.note.length > 0, `${s.name} is a 'from' price but has no note`);
  }
});

test("premium pricing is reflected (Soft Glam at new tier, not the old 140)", () => {
  const glam = getCategory("qasr-glam")!;
  const soft = glam.items.find((i) => i.name === "Soft Glam");
  assert.ok(soft && soft.price === 700, "Soft Glam should be AED 700 (net) in the new menu");
});
