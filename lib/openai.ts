import "server-only";
import { put } from "@vercel/blob";
import { prisma } from "./prisma";
import { slugify } from "./utils";
import { SITE } from "./site";
import { blogImagePrompt, pickHeroImage } from "./blog-image-core";
import { getTextProvider, getImageProvider } from "./ai";

/**
 * Generate one thematic hero image for a post and store it on Vercel Blob.
 * Best-effort: returns the Blob URL, or null on any failure (missing key/token,
 * timeout, API error) so the caller can fall back to a static image. The image
 * is created once at post creation and cached forever — no per-view cost.
 * Image bytes come from the configured ImageProvider; storage stays here.
 */
async function generateHeroImage(topicText: string, slug: string): Promise<string | null> {
  const imageProvider = getImageProvider();
  if (!imageProvider) return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null; // nowhere to store it → use fallback
  // Keep under the cron's 60s budget (text-gen runs first); on timeout we fall back.
  const bytes = await imageProvider.generateImage(blogImagePrompt(topicText), {
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

type Generated = {
  title: string;
  excerpt: string;
  metaDescription: string;
  contentMarkdown: string;
  tags: string[];
  category: string;
};

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

  const topic = opts?.title
    ? { title: opts.title, keywords: opts.keywords ?? [], id: null as string | null }
    : await nextTopic();

  const title = topic?.title ?? "Seasonal Beauty Tips from Qasr Alshar";
  const keywords = (topic?.keywords ?? []).join(", ");

  const system = `You are a real beauty writer for "Qasr Alshar Salon", a luxury multicultural salon in Dubai near Union Metro. Specialties: braiding, locs, henna, nails, facials, makeup, lashes, waxing, threading, massage.

Write like a knowledgeable human, not an AI. Hard rules:
- Sound 100% natural and human. NEVER use AI clichés or filler such as "In today's fast-paced world", "Look no further", "Nestled in", "Whether you're … or …", "Elevate", "Unlock", "delve", "In conclusion", "When it comes to". No em-dash overuse.
- Be specific and concrete (real Dubai context, real product/technique names, real timeframes). Vary sentence length so it reads like a person wrote it.
- Crisp and useful — no padding. Every sentence earns its place.
- Markdown with ## headings and short bullet lists. Do NOT include the H1 title in the body.`;

  const user = `Write a short, crisp blog post.
Topic: "${title}"
Target keywords: ${keywords || "Dubai beauty salon"}
Requirements:
- 300–450 words, Markdown body only (no front matter, no H1).
- 2–3 focused sections with ## headings.
- Bullet points for any tips or lists (max 4 bullets per list).
- One short closing call-to-action sentence linking to ${SITE.url}/book.
- No generic filler ("In today's fast-paced world…"). Get straight to the point.
Return ONLY JSON with keys:
{"title": string (compelling, <=65 chars, may refine the topic),
 "metaDescription": string (<=155 chars, SEO),
 "excerpt": string (<=160 chars, friendly summary),
 "tags": string[] (3-6 lowercase tags),
 "category": string (e.g. "Hair", "Henna", "Skincare", "Nails", "Bridal", "Beauty Tips"),
 "contentMarkdown": string}`;

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

  // Thematic hero: a generated on-topic image (stored on Blob), else a
  // matching static gallery image so a post always has a relevant hero.
  const heroText = `${parsed.title} ${parsed.tags?.join(" ") ?? ""} ${parsed.category ?? ""}`;
  const heroImage = (await generateHeroImage(heroText, slug)) ?? pickHeroImage(heroText);

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
      readingMinutes,
      status: "PUBLISHED",
      source: "AI",
    },
  });

  if (topic?.id) {
    await prisma.blogTopic.update({
      where: { id: topic.id },
      data: { used: true, lastUsed: new Date() },
    });
  }

  console.log(`[openai] published "${post.title}" (${slug})`);
  return post;
}
