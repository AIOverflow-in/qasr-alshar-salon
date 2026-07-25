// Pure, dependency-free helpers for blog hero imagery — unit-tested in
// blog-image-core.test.ts. No prisma / server-only / network here so it can be
// imported from both the generator (lib/openai.ts) and the test runner.

/**
 * Shared look appended to every generated image prompt. Rewritten for natural,
 * varied realism (real diverse people, palette that suits the subject) instead
 * of the old fixed gold/black faceless flat-lay that made every image feel the
 * same. Brand-safety + the hard "no text/logos" rules stay.
 */
export const BLOG_IMAGE_STYLE =
  "Natural, editorial documentary photograph of a real high-end multicultural ladies' salon in Dubai. Authentic candid moment with real women that reflect the salon's multicultural clientele — a natural mix of Black and white women — with genuine textures and expressions, natural light and shallow depth of field. The image must clearly show the actual service being discussed (the technique in progress or its finished result), not a generic flat-lay. Colours, mood and setting that suit the subject. Tasteful, elegant and brand-safe. Absolutely no text, no words, no letters, no logos, no watermarks, no signage.";

// Camera / light treatments rotated per post (by slug hash) so even two posts in
// the same cluster look different. These modify lens/angle/light only — they never
// dictate the subject, so they compose cleanly with any bespoke scene.
const TREATMENTS = [
  "35mm lens, eye-level, soft natural window light, warm afternoon tone",
  "85mm lens, gentle over-the-shoulder angle, bright diffused daylight",
  "close-up with shallow depth of field, soft directional light",
  "wider environmental framing, cinematic side light, airy and clean",
  "candid three-quarter angle, golden-hour warmth, subtle film grain",
  "low-angle detail, crisp even light, editorial magazine feel",
];

/** Deterministic string hash (no Math.random — keeps builds/tests reproducible). */
export function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0;
  return h;
}

/** Pick a camera/light treatment for a post, rotated by its slug. */
export function photoTreatment(seed: string): string {
  return TREATMENTS[hashSeed(seed) % TREATMENTS.length];
}

// Topic → concrete scene. Ordered most-specific first, with the specific
// service themes (henna, lashes, nails, braids…) ahead of the generic
// "bridal / makeup / hair" qualifiers so "bridal henna" reads as henna while
// "wedding makeup" still reads as bridal. The generic hair vignette sits last
// so it never steals a waxing/threading topic. Each scene is a tasteful still
// life / salon vignette with no faces.
const SCENES: [RegExp, string][] = [
  [/henna|mehndi/, "An intricate henna still life: a filled henna cone drawing an arabesque floral pattern, with gold bangles on richly draped fabric"],
  [/lash|eyelash/, "A refined lash-extension tray: individual lash fans, precision tweezers and a rose on a glossy black surface"],
  [/nail|manicure|pedicure|gelish|polygel/, "A chic nail-bar flat lay: rows of nude and gold gel polishes, a buffer and delicate rings on a pale marble surface"],
  [/knotless|box braid|braid|cornrow|feed.?in/, "A close, artful braiding detail: neat knotless braids with gold cuffs, styling tools resting nearby, warm salon light"],
  [/sisterlock|micro loc|\bloc\b|locs|dreadlock/, "A refined locs detail shot: neatly maintained locs adorned with gold charms, soft directional salon lighting"],
  [/weav|sew.?in|wig|frontal|closure/, "An elegant hair vignette: a sleek styled wig on a stand beside a soft-bristle brush and a gold hand mirror"],
  [/wax|waxing|hair removal/, "A clean, spa-like waxing station: neatly arranged wax pot, wooden spatulas, soft towels and calming botanicals on a bright marble counter"],
  [/thread|brow|eyebrow/, "A close, elegant brow-shaping vignette: fine threading spool, brow tools and a small mirror on a soft neutral surface"],
  [/keratin|botox|olaplex|k18|treatment|bond|repair/, "A premium hair-treatment flat lay: amber treatment bottles, a wide-tooth comb and a folded towel on dark marble, glossy hair strands"],
  [/color|colour|balayage|highlight|toner|bleach|air touch/, "A hair-colour still life: a tinting bowl and brush, foils and swatches of caramel and honey tones on a clean salon counter"],
  [/bridal|wedding|bride/, "An elegant bridal beauty flat lay: fine makeup brushes, a gold compact, soft blush tones, delicate jewelry and white florals on a marble surface"],
  [/soft glam|full glam|glam|makeup|beat|cosmetic/, "A luxurious makeup vanity flat lay: premium eyeshadow palette, lipsticks, brushes and a gold hand mirror on a dark marble surface"],
  [/facial|skin|hydra|glow|brighten/, "A serene skincare flat lay: glass serum dropper, cream jar, a rolled white towel and eucalyptus on a soft stone surface"],
  [/blow ?dry|hollywood|ponytail|style|styling|hair/, "A glossy blow-dry vignette: a round brush and professional dryer beside softly waved, shiny hair under warm salon light"],
  [/massage|relax|spa/, "A tranquil spa still life: warm stones, a rolled towel, a small bowl of oil and a single orchid on smooth wood"],
];

// Local fallback hero, keyed with the SAME specificity order. Used when
// generation is unavailable so a post always gets an on-theme image.
const FALLBACKS: [RegExp, string][] = [
  [/henna|mehndi/, "/gallery/henna-feature.jpg"],
  [/lash|eyelash/, "/gallery/lashes.jpg"],
  [/nail|manicure|pedicure|gelish|polygel/, "/gallery/nails.jpg"],
  [/knotless|box braid|braid|cornrow|feed.?in/, "/gallery/braiding.jpg"],
  [/sisterlock|micro loc|\bloc\b|locs|dreadlock/, "/gallery/locs.jpg"],
  [/weav|sew.?in|wig|frontal|closure/, "/gallery/weaving.jpg"],
  [/wax|waxing|hair removal/, "/gallery/waxing.jpg"],
  [/thread|brow|eyebrow/, "/gallery/threading.jpg"],
  [/facial|skin|hydra|glow|brighten/, "/gallery/facial.jpg"],
  [/bridal|wedding|bride/, "/gallery/makeup.jpg"],
  [/glam|makeup|beat|cosmetic/, "/gallery/makeup.jpg"],
  [/massage|relax|spa/, "/gallery/massage.jpg"],
  [/keratin|botox|olaplex|k18|treatment|color|colour|balayage|blow ?dry|hollywood|style|hair/, "/gallery/hair.jpg"],
];

/** Map a topic to a concrete fallback scene (used when the writer gives no bespoke prompt). */
export function sceneFor(text: string): string {
  const t = (text || "").toLowerCase();
  return SCENES.find(([re]) => re.test(t))?.[1]
    ?? "A natural, candid moment inside an elegant Dubai multicultural salon";
}

/** Build a thematic image-generation prompt for a blog topic (category fallback). */
export function blogImagePrompt(text: string): string {
  return `${sceneFor(text)}. ${BLOG_IMAGE_STYLE}`;
}

/**
 * Compose the final image prompt. Prefers the writer's bespoke, per-post scene
 * (real people + palette that fits the topic); falls back to the category scene
 * when absent. A per-slug camera/light treatment is always mixed in for variety.
 */
export function composeImagePrompt(bespoke: string | null | undefined, categoryText: string, seed: string): string {
  const scene = bespoke && bespoke.trim().length > 12 ? bespoke.trim() : sceneFor(categoryText);
  return `${scene}. ${photoTreatment(seed)}. ${BLOG_IMAGE_STYLE}`;
}

/** Map a topic to the most relevant existing local hero image (zero-cost fallback). */
export function pickHeroImage(text: string): string {
  const t = (text || "").toLowerCase();
  return FALLBACKS.find(([re]) => re.test(t))?.[1] ?? "/gallery/hero.jpg";
}

// ── Original salon photography ──────────────────────────────────────────────
// A curated gallery of the salon's OWN work photos (public/work/*). Blogs pick a
// real, on-topic image from here so posts show genuine salon work — what Google
// (and clients) value — instead of AI-generated or stock imagery. Add more files
// to a bucket and they're used automatically; the per-slug hash keeps same-topic
// posts on different photos.
const w = (dir: string, ...names: string[]) => names.map((n) => `/work/${dir}/${n}.jpg`);

const CORNROWS = w("hair",
  "braiding-cornrows-01", "braiding-cornrows-02", "braiding-cornrows-03",
  "braiding-stitch-01", "braiding-stitch-02", "braiding-stitch-03", "braiding-stitch-04", "braiding-stitch-05");
const KNOTLESS = w("hair",
  "braiding-knotless-01", "braiding-knotless-02", "braiding-knotless-03", "braiding-knotless-04", "braiding-knotless-05");
const LOCS = w("hair",
  "braiding-sisterlocks-01", "braiding-sisterlocks-02", "braiding-sisterlocks-03", "braiding-sisterlocks-04",
  "braiding-locs-crochet-01", "braiding-locs-crochet-02", "braiding-locs-crochet-03", "braiding-locs-crochet-04", "braiding-locs-crochet-05", "braiding-locs-crochet-06");
const BOHO = w("hair",
  "braiding-boho-01", "braiding-boho-02", "braiding-boho-03", "braiding-boho-04", "braiding-boho-05", "braiding-boho-06", "braiding-boho-07",
  "braiding-french-curl-01", "braiding-french-curl-02", "braiding-french-curl-03",
  "braiding-crochet-01", "braiding-crochet-02", "braiding-crochet-03");
const WIGS = w("hair", "wig-01", "wig-02", "wig-03");
const BRAIDS = [...KNOTLESS, ...CORNROWS, ...BOHO];
const HENNA_WORK = w("henna", "henna-hand-01", "henna-hand-02", "henna-body-spine-01", "henna-body-spine-02");
const NAILS_WORK = [...w("nails",
  "nail-manicure-01", "nail-manicure-02", "nail-manicure-03", "nail-manicure-04", "nail-manicure-05",
  "nail-manicure-07", "nail-manicure-08", "nail-manicure-09"),
  "/work/nails/nail-manicure-06.png"];
const PEDICURE = w("nails", "pedicure-new-01");

// Most-specific first (knotless/locs/cornrow/boho before the generic "braid").
const WORK: [RegExp, string[]][] = [
  [/knotless/, KNOTLESS],
  [/sisterlock|micro ?loc|\bloc\b|locs|dreadlock/, LOCS],
  [/cornrow|feed.?in|stitch braid/, CORNROWS],
  [/boho|french curl|crochet|fulani|box braid/, BOHO],
  [/weav|sew.?in|\bwig|frontal|closure/, WIGS],
  [/\bbraid|protective style/, BRAIDS],
  [/henna|mehndi/, HENNA_WORK],
  [/pedicure|toe ?nail|\btoes\b/, PEDICURE],
  [/nail|manicure|gelish|polygel|acrylic|gel/, NAILS_WORK],
];

/**
 * A REAL, on-topic photo from the salon's own work gallery for this topic, or
 * null when we have none for it (so the caller can generate a unique AI image
 * instead of reusing a static one). The slug seed rotates which photo is used so
 * same-topic posts never repeat.
 */
export function pickWorkPhoto(text: string, seed: string): string | null {
  const t = (text || "").toLowerCase();
  for (const [re, photos] of WORK) {
    if (re.test(t) && photos.length) return photos[hashSeed(seed) % photos.length];
  }
  return null;
}

/**
 * Best real image for a topic: an original work photo if we have one, else the
 * closest static gallery image. Always returns a valid local path.
 */
export function pickBlogPhoto(text: string, seed: string): string {
  return pickWorkPhoto(text, seed) ?? pickHeroImage(text);
}
