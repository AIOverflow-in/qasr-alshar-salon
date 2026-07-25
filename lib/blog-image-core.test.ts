import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blogImagePrompt, pickHeroImage, composeImagePrompt, photoTreatment, sceneFor, BLOG_IMAGE_STYLE, pickBlogPhoto, pickWorkPhoto,
} from "./blog-image-core.ts";

test("category fallback is thematic: wedding-makeup → bridal, waxing → waxing", () => {
  assert.match(blogImagePrompt("Choosing the Right Makeup for Dubai Weddings"), /bridal/i);
  const wax = blogImagePrompt("Everything to know before your first waxing appointment");
  assert.match(wax, /wax/i);
  assert.doesNotMatch(wax, /blow.?dry|braid/i);
});

test("fallback distinguishes braids, locs, henna, nails", () => {
  assert.match(blogImagePrompt("How to care for knotless braids"), /braid/i);
  assert.match(blogImagePrompt("Sisterlocks 101"), /locs/i);
  assert.match(blogImagePrompt("Bridal henna trends"), /henna/i);
  assert.match(blogImagePrompt("Making your gel manicure last"), /nail|gel/i);
});

test("brand style allows real people, asks for a diverse mix + the actual service, keeps the hard no-text rule", () => {
  assert.match(BLOG_IMAGE_STYLE, /no text.*no logos|no logos.*no watermarks/i);
  assert.doesNotMatch(BLOG_IMAGE_STYLE, /no visible human faces/i); // people are allowed now
  assert.match(BLOG_IMAGE_STYLE, /mix of Black and white women/i); // multicultural diversity is explicit
  assert.match(BLOG_IMAGE_STYLE, /actual service/i); // service-accurate, not a generic flat-lay
});

test("composeImagePrompt prefers the writer's bespoke scene over the category one", () => {
  const bespoke = "A stylist mid-braid weaving fresh cornrows for a smiling client, gold cuffs catching the light";
  const p = composeImagePrompt(bespoke, "braids topic", "some-slug");
  assert.ok(p.startsWith(bespoke));
  assert.ok(p.endsWith(BLOG_IMAGE_STYLE));
});

test("composeImagePrompt falls back to the category scene when bespoke is missing/too short", () => {
  const p = composeImagePrompt("", "henna guide", "slug-1");
  assert.ok(p.includes(sceneFor("henna guide")));
  const p2 = composeImagePrompt("tiny", "nails", "slug-2");
  assert.ok(p2.includes(sceneFor("nails")));
});

test("photoTreatment is deterministic per seed and varies across seeds", () => {
  assert.equal(photoTreatment("post-a"), photoTreatment("post-a")); // stable
  const treatments = ["a", "b", "c", "d", "e", "f", "g", "h"].map(photoTreatment);
  assert.ok(new Set(treatments).size > 1); // not all identical → variety
});

test("pickBlogPhoto returns a REAL, on-topic salon work photo", () => {
  assert.match(pickBlogPhoto("Best knotless braids in Dubai", "s1"), /^\/work\/hair\/braiding-knotless-.+\.jpg$/);
  assert.match(pickBlogPhoto("Fulani braids guide", "s2"), /^\/work\/hair\/braiding-.+\.jpg$/);
  assert.match(pickBlogPhoto("Cornrow updo styles", "s3"), /^\/work\/hair\/braiding-(cornrow|stitch).+\.jpg$/);
  assert.match(pickBlogPhoto("Loc retwist Dubai", "s4"), /^\/work\/hair\/braiding-(loc|sisterlock).+\.jpg$/);
  assert.match(pickBlogPhoto("Bridal henna designs", "s5"), /^\/work\/henna\/henna-.+\.jpg$/);
  assert.match(pickBlogPhoto("Gel manicure aftercare", "s6"), /^\/work\/nails\/nail-.+\.(jpg|png)$/);
  assert.match(pickBlogPhoto("Medical pedicure", "s7"), /^\/work\/nails\/pedicure-.+\.jpg$/);
});

test("pickWorkPhoto returns null when we have no original photo for the topic (→ caller AI-generates)", () => {
  assert.equal(pickWorkPhoto("hydra facial glow", "x"), null);
  assert.equal(pickWorkPhoto("russian lash extensions", "x"), null);
  assert.equal(pickWorkPhoto("keratin treatment", "x"), null);
  assert.equal(pickWorkPhoto("relaxing massage", "x"), null);
  // but a topic we DO have originals for returns a real work photo, not null
  assert.match(pickWorkPhoto("knotless braids", "x")!, /^\/work\/hair\/braiding-knotless-/);
});

test("pickBlogPhoto falls back to a valid gallery image for non-work topics, and is deterministic", () => {
  assert.equal(pickBlogPhoto("Hydra facial glow", "x"), "/gallery/facial.jpg");
  assert.match(pickBlogPhoto("waxing tips", "x"), /^\/gallery\/.+\.jpg$/);
  assert.equal(pickBlogPhoto("knotless braids", "same"), pickBlogPhoto("knotless braids", "same")); // stable per seed
  const varied = ["a", "b", "c", "d", "e"].map((s) => pickBlogPhoto("knotless braids", s));
  assert.ok(new Set(varied).size > 1); // rotates across posts
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
