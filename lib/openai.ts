import "server-only";
import { put } from "@vercel/blob";
import { prisma } from "./prisma";
import { slugify } from "./utils";
import { SITE } from "./site";
import { pickWorkPhoto, pickHeroImage, composeImagePrompt } from "./blog-image-core";
import { stripEmDashes } from "./blog-content-core";
import { getTextProvider, getImageProvider } from "./ai";
import { clusterToServicePath } from "./keyword-core";
import { clusterPriceContext } from "./service-pricing";
import { ensureSeeded, selectNextKeyword, markKeywordUsed } from "./keywords";

/**
 * FALLBACK ONLY: when we have no real salon photo for a topic, generate a UNIQUE
 * AI hero image so same-topic posts never reuse one static photo, and store it on
 * Vercel Blob. Returns the Blob URL, or null on any failure (no key/token,
 * timeout, error) so the caller drops to a static gallery image. Created once at
 * post creation and cached forever — no per-view cost.
 */
async function generateHeroImage(topic: string, slug: string): Promise<string | null> {
  const imageProvider = getImageProvider();
  if (!imageProvider) return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null; // nowhere to store it → gallery fallback
  const bytes = await imageProvider.generateImage(composeImagePrompt(undefined, topic, slug), {
    size: "1536x1024",
    quality: "medium",
    timeoutMs: 35_000,
  });
  if (!bytes) return null;
  try {
    const blob = await put(`blog-images/${slug}.png`, bytes, { access: "public", contentType: "image/png", addRandomSuffix: true });
    console.log(`[blog] AI fallback hero for "${slug}" → ${blob.url}`);
    return blob.url;
  } catch (e) {
    console.error("[blog] hero image storage failed, using gallery fallback:", e);
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
};

/** Validate the model's FAQ into a clean [{q,a}] array (or null) for storage + JSON-LD. */
function sanitizeFaq(faq: unknown): FaqItem[] | null {
  if (!Array.isArray(faq)) return null;
  const out: FaqItem[] = [];
  for (const item of faq) {
    const q = stripEmDashes(String((item as FaqItem)?.q ?? "").trim());
    const a = stripEmDashes(String((item as FaqItem)?.a ?? "").trim());
    if (q.length >= 5 && a.length >= 5) out.push({ q: q.slice(0, 200), a: a.slice(0, 600) });
    if (out.length >= 12) break;
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
  const bookUrl = `${SITE.url}/book`;
  const waLink = `https://wa.me/${SITE.whatsapp.replace(/[^0-9]/g, "")}`;

  // Valid internal links the writer may use (avoids 404s). 2–4 per post builds
  // topical authority and guides readers toward booking.
  const internalLinks = [
    `${serviceUrl}  → our ${cluster === "general" ? "" : cluster + " "}services`,
    `${SITE.url}/services  → all services`,
    `${bookUrl}  → book an appointment`,
  ].join("\n");

  // Related recent posts, so the cluster interlinks itself (topical authority).
  const recent = await prisma.blogPost
    .findMany({ where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 4, select: { title: true, slug: true } })
    .catch(() => []);
  const relatedLinks = recent.length
    ? "Related articles you may link ONE or two of, where genuinely relevant:\n" + recent.map((r) => `${SITE.url}/blog/${r.slug}  → ${r.title}`).join("\n")
    : "";

  // Ground the writer in REAL, VAT-inclusive prices so it quotes accurate figures
  // (never invented) and only ONCE (a repeated price list reads as cheap).
  const priceContext = clusterPriceContext(cluster);
  const priceGuidance = priceContext
    ? `- Money: mention price at most ONCE in the prose (a natural range), and/or once inside the comparison table. Do NOT repeat prices across paragraphs, a repeated price list makes us look cheap. Use ONLY these real, VAT-inclusive figures and never invent one: ${priceContext} If a variant isn't listed, say the price depends on length/design and is confirmed at the salon.`
    : `- If you mention price, keep it to a single general, honest line (prices vary with length and design, confirmed at the salon). Do NOT invent figures.`;

  const system = `You are the in-house beauty editor for "Qasr Alshar Salon", a luxury multicultural salon in Dubai near Union Metro, and the go-to authority on African and textured hair in Dubai (braids, cornrows, knotless, locs, weaves) as well as henna, nails, facials, makeup, lashes, waxing, threading and massage. Our senior "crown artists" specialise in protective styling and Afro/textured hair, and we serve clients of every origin (Nigeria, Kenya, Uganda, Sudan, Ethiopia, the Gulf, Europe and beyond).

Your goal: write the single most helpful guide on this topic in Dubai, so good the reader needs no other article. Teach generously; sell almost never.

Voice: warm, feminine, quietly confident and genuinely caring about the reader's hair and results. Educational first, like a trusted senior stylist talking to a client she respects. Conversational and unmistakably human. Above all EDITORIAL and MAGNETIC: catchy, sophisticated and inviting from the very first line, the kind of writing a discerning, well-educated reader (a founder, a lawyer, a doctor) would actually stop and read. Never basic, never generic.

HARD RULES:
- NEVER use an em-dash ("—"). Use commas, full stops or brackets instead. Em-dashes read as AI and must not appear. (A hyphen inside a number range like "6-8 weeks" is fine.)
- No AI clichés or filler ("In today's fast-paced world", "Look no further", "Nestled in", "Whether you're … or …", "Elevate", "Unlock", "delve", "In conclusion", "When it comes to"). Vary sentence length so it reads human.
- TEACH, don't sell. Explain the how and the why (why knotless braids take longer than cornrows, how tension affects the scalp, which style suits which texture). Mention the salon at most once or twice in the whole piece, softly.
- Be specific and honest: real techniques, real timeframes, genuine upsides AND trade-offs, real Dubai context (heat, humidity, neighbourhoods).
- Trust signals must be TRUE: our crown artists' Afro/textured-hair specialism, the origins we serve, hygienic tools, honest advice. NEVER invent years of experience, client counts, awards or named people.
- POSITIONING: we are a PREMIUM destination for textured-hair and beauty expertise. Never frame the salon or the reader through a "cheap", "budget" or merely "black-friendly" lens; sell craft, confidence and results, never a low price or ethnicity as the hook. Braids, cornrows and locs are PROTECTIVE styles, so show real expertise: hydration treatment before styling, correct tension, and aftercare tuned to Dubai's heat and hard water.
- HOOK & CONVERSION: a discerning reader gives you about 60 seconds. Open with a magnetic, specific hook (never "In this post", "Are you looking for", "In today's world"), keep it scannable, and make her confident enough to book after a single skim.
- Markdown: ## headings, short paragraphs, bullet lists, one table where useful. Do NOT include the H1 title in the body.`;

  const user = `Write the best, most complete guide in Dubai on this topic.
Primary keyword (use naturally in the title, the first paragraph, and one ## heading): "${primaryKeyword}"
Related terms to weave in naturally: ${secondary.join(", ") || "(none)"}

STRUCTURE & CONTENT:
- Title: <=60 chars, includes the primary keyword or a close variant. Magnetic and editorial, never clickbait and never basic.
- 550–850 words, tight and scannable, zero padding. Open with a magnetic hook (a bold, specific one or two sentences a discerning reader cannot skip, not a definition), then 4–5 focused ## sections that answer what people actually search. Pick the sections that fit the topic, e.g.: how long it lasts, which style suits which hair texture, caring for it in Dubai's heat and humidity, maintenance and washing, swimming, styles for kids, prep before the appointment, aftercare and safe removal, or how to choose between two options.
- Teach the real differences between related styles or products (e.g. knotless vs cornrows vs box braids: time, tension, longevity, who each suits).
${priceGuidance}
- Include exactly ONE Markdown comparison table where it genuinely helps (e.g. styles by time, how long they last, and price only if you have real figures above). Every cell must be accurate; never invent a price.
- Mention 1–3 Dubai neighbourhoods naturally where clients come to us from (Deira, Al Rigga, Bur Dubai, Karama, Al Nahda, Dubai Marina, JLT, JVC, Business Bay). Never a stuffed list.
- Weave in TRUE trust signals (crown-artist Afro/textured-hair specialism, origins served, hygiene, honest advice). No invented numbers.
- Internal links: add 2–4 natural links on relevant anchor text, using ONLY these URLs:
${internalLinks}
${relatedLinks}
- End with a warm, low-friction call to action: invite the reader to WhatsApp us a photo of the style they want plus their hair length for a quick estimate, or book online. Use the booking link ${bookUrl} and mention WhatsApp (${waLink}).
- Series: if it truly fits, frame the piece as "Hair Diaries" (a first-person client/stylist story), "Ask the Stylist" (one real question answered in depth) or "Beauty Myth Busters" (debunk a myth), and set "category" accordingly. Don't force it.
- Do NOT put the FAQ inside contentMarkdown — return it separately in "faq".

Return ONLY JSON with keys:
{"title": string,
 "metaDescription": string (<=155 chars, include the primary keyword),
 "excerpt": string (<=160 chars, friendly summary),
 "tags": string[] (3-6 lowercase tags),
 "category": string (a normal category e.g. "Hair", "Henna", "Skincare", "Nails", "Bridal", "Beauty Tips", OR a series: "Hair Diaries", "Ask the Stylist", "Beauty Myth Busters"),
 "contentMarkdown": string (the guide body incl. the comparison table; no FAQ, no H1),
 "faq": [{"q": string, "a": string}] (8-12 real "people also ask" questions with concise, genuinely useful answers — target long-tail searches like cost, how long it lasts, washing, swimming, kids, natural hair, bringing your own extensions)}`;

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

  // Hero: prefer a REAL, on-topic salon photo (original photography Google + clients
  // value). If we have none for this topic, generate a UNIQUE AI image so same-topic
  // posts never reuse one static photo. Fall back to a matching gallery image only
  // if AI generation is unavailable.
  const heroText = `${primaryKeyword} ${parsed.tags?.join(" ") ?? ""} ${parsed.category ?? ""}`;
  const heroImage = pickWorkPhoto(heroText, slug) ?? (await generateHeroImage(heroText, slug)) ?? pickHeroImage(heroText);

  const post = await prisma.blogPost.create({
    data: {
      title: parsed.title.slice(0, 120),
      slug,
      excerpt: (parsed.excerpt || parsed.metaDescription || "").slice(0, 200),
      metaDescription: (parsed.metaDescription || parsed.excerpt || "").slice(0, 165),
      contentMarkdown: stripEmDashes(parsed.contentMarkdown),
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
