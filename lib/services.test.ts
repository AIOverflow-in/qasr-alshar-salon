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

test("premium pricing is reflected + VAT-inclusive (Soft Glam)", () => {
  const glam = getCategory("qasr-glam")!;
  const soft = glam.items.find((i) => i.name === "Soft Glam");
  // 700 net → 735 gross (700 × 1.05, rounded) now that menu prices are VAT-inclusive.
  assert.ok(soft && soft.price === 735, `Soft Glam should be AED 735 (700 +5% VAT, inclusive); got ${soft?.price}`);
});

// Guards against a future category-slug rename silently blanking a section.
// Keep in sync with the slugs hardcoded in app/page.tsx (homepage "Our Services"
// grid) and GALLERY_PHOTOS in app/services/[category]/page.tsx.
test("slugs referenced by the homepage grid all exist", () => {
  const slugs = new Set(CATEGORIES.map((c) => c.slug));
  for (const s of ["braiding-styles", "hair-treatment", "hands", "qasr-glam", "henna", "weaving"]) {
    assert.ok(slugs.has(s), `homepage features "${s}" but no such category exists`);
  }
});

test("slugs keyed by the category 'Our Work' gallery all exist", () => {
  const slugs = new Set(CATEGORIES.map((c) => c.slug));
  for (const s of ["cornrow-styles", "braiding-styles", "locks", "hands", "podology", "henna"]) {
    assert.ok(slugs.has(s), `gallery keyed on "${s}" but no such category exists`);
  }
});
