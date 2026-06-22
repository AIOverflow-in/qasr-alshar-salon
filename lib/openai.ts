import "server-only";
import OpenAI from "openai";
import { prisma } from "./prisma";
import { slugify } from "./utils";
import { SITE } from "./site";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const MODEL = process.env.OPENAI_BLOG_MODEL || "gpt-5";

/** Map a topic to the most relevant existing hero image. */
function pickHeroImage(text: string): string {
  const t = text.toLowerCase();
  const map: [string, string][] = [
    ["henna", "/gallery/henna-feature.jpg"],
    ["braid", "/gallery/braiding.jpg"],
    ["loc", "/gallery/braiding.jpg"],
    ["sisterlock", "/gallery/braiding.jpg"],
    ["weav", "/gallery/weaving.jpg"],
    ["wig", "/gallery/weaving.jpg"],
    ["nail", "/gallery/nails.jpg"],
    ["manicure", "/gallery/nails.jpg"],
    ["facial", "/gallery/facial.jpg"],
    ["skin", "/gallery/facial.jpg"],
    ["makeup", "/gallery/makeup.jpg"],
    ["bridal", "/gallery/makeup.jpg"],
    ["lash", "/gallery/lashes.jpg"],
    ["keratin", "/gallery/hair.jpg"],
    ["botox", "/gallery/hair.jpg"],
    ["hair", "/gallery/hair.jpg"],
    ["wax", "/gallery/waxing.jpg"],
    ["massage", "/gallery/massage.jpg"],
  ];
  for (const [k, img] of map) if (t.includes(k)) return img;
  return "/gallery/hero.jpg";
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
  if (!client) {
    console.warn("[openai] OPENAI_API_KEY not set — cannot generate blog post");
    return null;
  }

  const topic = opts?.title
    ? { title: opts.title, keywords: opts.keywords ?? [], id: null as string | null }
    : await nextTopic();

  const title = topic?.title ?? "Seasonal Beauty Tips from Qasr Alshar";
  const keywords = (topic?.keywords ?? []).join(", ");

  const system = `You are an expert SEO content writer for "Qasr Alshar Salon", a luxury multicultural beauty salon in Dubai, UAE (located near Union Metro). The salon specializes in braiding, weaving, wigs, hair, nails, facials, makeup, henna, lashes, waxing, threading and massage, serving a diverse clientele. Write warm, authoritative, genuinely helpful articles that rank well on Google for UAE beauty searches. Naturally weave in Dubai/UAE context and a soft call-to-action to book at Qasr Alshar. Avoid keyword stuffing. Use Markdown with ## and ### headings, short paragraphs, and bullet lists where useful. Do NOT include the H1 title in the body.`;

  const user = `Write a complete, original blog article.
Topic: "${title}"
Target keywords: ${keywords || "Dubai beauty salon"}
Requirements:
- 700–1000 words, Markdown body only (no front matter, no H1).
- Helpful, specific, locally relevant to Dubai/UAE.
- End with a short call-to-action to book at Qasr Alshar (${SITE.url}/book).
Return ONLY JSON with keys:
{"title": string (compelling, <=65 chars, may refine the topic),
 "metaDescription": string (<=155 chars, SEO),
 "excerpt": string (<=160 chars, friendly summary),
 "tags": string[] (3-6 lowercase tags),
 "category": string (e.g. "Hair", "Henna", "Skincare", "Nails", "Bridal", "Beauty Tips"),
 "contentMarkdown": string}`;

  let parsed: Generated;
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    parsed = JSON.parse(raw) as Generated;
  } catch (e) {
    console.error("[openai] generation failed:", e);
    return null;
  }

  if (!parsed.title || !parsed.contentMarkdown) return null;

  const words = parsed.contentMarkdown.trim().split(/\s+/).length;
  const readingMinutes = Math.max(2, Math.round(words / 200));
  const slug = await uniqueSlug(parsed.title);

  const post = await prisma.blogPost.create({
    data: {
      title: parsed.title.slice(0, 120),
      slug,
      excerpt: (parsed.excerpt || parsed.metaDescription || "").slice(0, 200),
      metaDescription: (parsed.metaDescription || parsed.excerpt || "").slice(0, 165),
      contentMarkdown: parsed.contentMarkdown,
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
      category: parsed.category || "Beauty Tips",
      heroImage: pickHeroImage(`${parsed.title} ${parsed.tags?.join(" ") ?? ""}`),
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
