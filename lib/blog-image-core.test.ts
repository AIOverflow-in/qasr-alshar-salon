import { test } from "node:test";
import assert from "node:assert/strict";
import { blogImagePrompt, pickHeroImage, BLOG_IMAGE_STYLE } from "./blog-image-core.ts";

test("prompt is thematic: wedding-makeup topic yields bridal imagery", () => {
  const p = blogImagePrompt("Choosing the Right Makeup for Dubai Weddings");
  assert.match(p, /bridal/i);
  assert.match(p, /no visible human faces/i); // brand-safe rule always present
});

test("prompt is thematic: waxing topic yields waxing imagery, not hair", () => {
  const p = blogImagePrompt("Everything to know before your first waxing appointment");
  assert.match(p, /wax/i);
  assert.doesNotMatch(p, /blow.?dry|braid/i);
});

test("prompt distinguishes braids, locs, henna, nails", () => {
  assert.match(blogImagePrompt("How to care for knotless braids"), /braid/i);
  assert.match(blogImagePrompt("Sisterlocks 101"), /locs/i);
  assert.match(blogImagePrompt("Bridal henna trends"), /henna/i);
  assert.match(blogImagePrompt("Making your gel manicure last"), /nail|gel/i);
});

test("prompt always carries the brand style suffix", () => {
  assert.ok(blogImagePrompt("anything at all").endsWith(BLOG_IMAGE_STYLE));
});

test("unknown topic still returns a usable, non-empty prompt", () => {
  const p = blogImagePrompt("A totally unrelated topic xyz");
  assert.ok(p.length > 20);
  assert.match(p, /salon/i);
});

test("fallback returns a valid local gallery path per theme", () => {
  assert.equal(pickHeroImage("wedding makeup"), "/gallery/makeup.jpg");
  assert.equal(pickHeroImage("waxing tips"), "/gallery/waxing.jpg");
  assert.equal(pickHeroImage("knotless braids"), "/gallery/braiding.jpg");
  assert.equal(pickHeroImage("something random"), "/gallery/hero.jpg");
  for (const topic of ["henna", "lash", "facial", "keratin", "massage"]) {
    assert.match(pickHeroImage(topic), /^\/gallery\/.+\.jpg$/);
  }
});
