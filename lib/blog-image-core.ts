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
