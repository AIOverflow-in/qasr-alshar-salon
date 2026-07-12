import "server-only";
import { put } from "@vercel/blob";
import { prisma } from "./prisma";
import { slugify } from "./utils";
import { SITE } from "./site";
import { composeImagePrompt, pickHeroImage } from "./blog-image-core";
import { getTextProvider, getImageProvider } from "./ai";
import { clusterToServicePath } from "./keyword-core";
import { clusterPriceContext } from "./service-pricing";
import { ensureSeeded, selectNextKeyword, markKeywordUsed } from "./keywords";

/**
 * Generate one thematic hero image for a post and store it on Vercel Blob.
 * Best-effort: returns the Blob URL, or null on any failure (missing key/token,
 * timeout, API error) so the caller can fall back to a static image. The image
 * is created once at post creation and cached forever — no per-view cost.
 * Image bytes come from the configured ImageProvider; storage stays here.
 */
async function generateHeroImage(bespokePrompt: string | null | undefined, categoryText: string, slug: string): Promise<string | null> {
  const imageProvider = getImageProvider();
  if (!imageProvider) return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null; // nowhere to store it → use fallback
  // Prefer the writer's bespoke, per-post scene; fall back to the category scene.
  // A per-slug camera/light treatment is mixed in so same-cluster posts still differ.
  // Keep under the cron's 60s budget (text-gen runs first); on timeout we fall back.
  const bytes = await imageProvider.generateImage(composeImagePrompt(bespokePrompt, categoryText, slug), {
    size: "1536x1024",
    quality: "medium",
    timeoutMs: 35_000,
  });
  if (!bytes) return null;
  try {
    const blob = await put(`blog-images/${slug}.png`, bytes, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: true,
    });
    console.log(`[blog] generated hero image for "${slug}" → ${blob.url}`);
    return blob.url;
  } catch (e) {
    console.error("[blog] hero image storage failed, using fallback:", e);
    return null;
  }
}

type FaqItem = { q: string; a: string };
type Generated = {
  title: string;
  excerpt: string;
  metaDescription: string;
  contentMarkdown: string;
  tags: string[];
  category: string;
  faq?: FaqItem[];
  imagePrompt?: string;
};

/** Validate the model's FAQ into a clean [{q,a}] array (or null) for storage + JSON-LD. */
function sanitizeFaq(faq: unknown): FaqItem[] | null {
  if (!Array.isArray(faq)) return null;
  const out: FaqItem[] = [];
  for (const item of faq) {
    const q = String((item as FaqItem)?.q ?? "").trim();
    const a = String((item as FaqItem)?.a ?? "").trim();
    if (q.length >= 5 && a.length >= 5) out.push({ q: q.slice(0, 200), a: a.slice(0, 600) });
    if (out.length >= 5) break;
  }
  return out.length ? out : null;
}

async function nextTopic() {
  const topic =
    (await prisma.blogTopic.findFirst({
      where: { used: false },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.blogTopic.findFirst({ orderBy: { lastUsed: "asc" } }));
  return topic;
}

async function uniqueSlug(base: string) {
  const root = slugify(base).slice(0, 70) || "beauty-tips";
  let slug = root;
  let i = 2;
  while (await prisma.blogPost.findUnique({ where: { slug } })) {
    slug = `${root}-${i++}`;
  }
  return slug;
}

/**
 * Generate one SEO-optimized blog post via OpenAI and store it (PUBLISHED).
 * Returns the created post, or null if generation is unavailable/failed.
 */
export async function generateBlogPost(opts?: {
  title?: string;
  keywords?: string[];
}) {
  const textProvider = getTextProvider();
  if (!textProvider) {
    console.warn("[blog] no text provider configured (missing API key) — cannot generate blog post");
    return null;
  }

  // Pick what to write about. Priority: explicit request → a rotated SEO keyword
  // from the harvest store → a legacy BlogTopic → an evergreen default.
  let primaryKeyword: string;
  let secondary: string[] = [];
  let cluster = "general";
  let targetKeyword: string | null = null;
  let legacyTopicId: string | null = null;

  if (opts?.title) {
    primaryKeyword = opts.title;
    secondary = opts.keywords ?? [];
  } else {
    await ensureSeeded();
    const kw = await selectNextKeyword();
    if (kw) {
      primaryKeyword = kw.phrase;
      secondary = kw.secondary;
      cluster = kw.cluster;
      targetKeyword = kw.phrase;
    } else {
      const topic = await nextTopic();
      if (topic) { primaryKeyword = topic.title; secondary = topic.keywords; legacyTopicId = topic.id; }
      else { primaryKeyword = "seasonal beauty tips dubai salon"; }
    }
  }

  const serviceUrl = `${SITE.url}${clusterToServicePath(cluster)}`;

  // Ground the writer in REAL, VAT-inclusive prices for this service area so it
  // quotes accurate ranges (never invented figures). Empty for general topics.
  const priceContext = clusterPriceContext(cluster);
  const priceGuidance = priceContext
    ? `- Money: use ONLY these real salon prices for this area — quote the ones that match what you're writing about, as a range where it fits: ${priceContext} Never invent a figure. If a reader might want a variant that isn't in this list, do NOT guess a number — say the price depends on the design/length and is confirmed at the salon. Prices are inclusive of 5% VAT; say so once if you mention price.`
    : `- If you mention price at all, keep it general and honest (prices vary with length and design and are confirmed at the salon). Do NOT invent specific figures.`;

  const system = `You are the in-house beauty editor for "Qasr Alshar Salon", a luxury multicultural salon in Dubai near Union Metro — part senior stylist, part luxury copywriter, part SEO strategist. Specialties: braiding, locs, henna, nails, facials, makeup, lashes, waxing, threading, massage. The salon serves all hair types including Afro / textured hair, and its senior "crown artists" are experienced specialists in protective styling and textured-hair care.

Voice: warm, feminine and quietly confident, luxurious without being flashy, educational and honest — like a trusted stylist talking to a client she respects. Conversational and unmistakably human.

Write like a knowledgeable human, not an AI. Hard rules:
- Sound 100% natural and human. NEVER use AI clichés or filler such as "In today's fast-paced world", "Look no further", "Nestled in", "Whether you're … or …", "Elevate", "Unlock", "delve", "In conclusion", "When it comes to". No em-dash overuse.
- Be specific and concrete (real Dubai context, real product/technique names, real timeframes). Vary sentence length so it reads like a person wrote it.
- Honest and balanced: give the real upsides AND the real trade-offs (upkeep, timing, comfort, aftercare) so a reader can decide with confidence. Educational, never fear-mongering or pushy.
- Crisp and useful — no padding. Every sentence earns its place.
- Markdown with ## headings and short bullet lists. Do NOT include the H1 title in the body.`;

  const user = `Write an SEO blog post built around real search demand.
Primary keyword (use it naturally in the title, the first paragraph, and at least one ## heading): "${primaryKeyword}"
Related terms to weave in where they fit naturally: ${secondary.join(", ") || "(none)"}

Requirements:
- Title: compelling, <=60 chars, includes the primary keyword or a very close variant. Not clickbait.
- 400–600 words, Markdown body only (no front matter, no H1).
- 2–3 focused ## sections; put the keyword/related terms in headings where it reads naturally.
- Real Dubai specifics (areas, timeframes, product/technique names).
${priceGuidance}
- Show real expertise: reference how our senior crown artists approach this service (their experience with textured / Afro hair, technique, tension, timing, aftercare). Do NOT invent named individuals or fake credentials.
- Be honest and balanced: include a short "what to know" beat with the genuine upsides AND the trade-offs (upkeep, longevity, comfort) and how we keep it healthy and safe. Educational, not fear-mongering.
- Include exactly ONE natural internal link in the body, anchored on relevant words, to our services page: ${serviceUrl}
- End with one short call-to-action sentence linking to ${SITE.url}/book.
- Do NOT put the FAQ inside contentMarkdown — return it separately in "faq".
- No generic AI filler. Get straight to the point.
- Series: if it genuinely fits the topic, frame the piece as an entry in one of our recurring series and set "category" to that series name — "Hair Diaries" (a first-person client/stylist story), "Ask the Stylist" (one real question answered in depth), or "Beauty Myth Busters" (debunk a common beauty myth). Otherwise use a normal category. Don't force it.
Return ONLY JSON with keys:
{"title": string,
 "metaDescription": string (<=155 chars, include the primary keyword),
 "excerpt": string (<=160 chars, friendly summary),
 "tags": string[] (3-6 lowercase tags),
 "category": string (a normal category e.g. "Hair", "Henna", "Skincare", "Nails", "Bridal", "Beauty Tips", OR a recurring series: "Hair Diaries", "Ask the Stylist", "Beauty Myth Busters"),
 "contentMarkdown": string (the article body, no FAQ),
 "faq": [{"q": string, "a": string}] (2-3 real "people also ask" questions + concise answers),
 "imagePrompt": string (a vivid, specific description of a NATURAL candid photograph for THIS exact article. It MUST depict the actual service the post is about — the technique in progress or its finished result (a braids post shows the finished braids, a makeup post shows the finished look, a facial post shows the treatment) — never a generic gold flat-lay. Feature real women reflecting the salon's multicultural clientele, a natural mix of Black and white women, in the salon setting with a colour/mood that fits the topic. No text or logos.)}`;

  let parsed: Generated;
  try {
    const raw = await textProvider.generateJSON(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.8 },
    );
    parsed = JSON.parse(raw) as Generated;
  } catch (e) {
    console.error("[blog] generation failed:", e);
    return null;
  }

  if (!parsed.title || !parsed.contentMarkdown) return null;

  const words = parsed.contentMarkdown.trim().split(/\s+/).length;
  const readingMinutes = Math.max(1, Math.round(words / 200));
  const slug = await uniqueSlug(parsed.title);

  // Hero: the writer's bespoke natural scene (generated + stored on Blob), else a
  // matching static gallery image so a post always has a relevant hero.
  const heroText = `${primaryKeyword} ${parsed.tags?.join(" ") ?? ""} ${parsed.category ?? ""}`;
  const heroImage = (await generateHeroImage(parsed.imagePrompt, heroText, slug)) ?? pickHeroImage(heroText);

  const post = await prisma.blogPost.create({
    data: {
      title: parsed.title.slice(0, 120),
      slug,
      excerpt: (parsed.excerpt || parsed.metaDescription || "").slice(0, 200),
      metaDescription: (parsed.metaDescription || parsed.excerpt || "").slice(0, 165),
      contentMarkdown: parsed.contentMarkdown,
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
      category: parsed.category || "Beauty Tips",
      heroImage,
      faq: sanitizeFaq(parsed.faq) ?? undefined,
      targetKeyword,
      readingMinutes,
      status: "PUBLISHED",
      source: "AI",
    },
  });

  // Rotation bookkeeping: mark the keyword used so tomorrow reaches for the next.
  if (targetKeyword) await markKeywordUsed(targetKeyword);
  if (legacyTopicId) {
    await prisma.blogTopic.update({ where: { id: legacyTopicId }, data: { used: true, lastUsed: new Date() } });
  }

  console.log(`[blog] published "${post.title}" (${slug})${targetKeyword ? ` [kw: ${targetKeyword}]` : ""}`);
  return post;
}
