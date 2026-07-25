// One-off: rewrite the "Black Friendly Beauty Salon" post into a premium,
// on-strategy piece (no stereotype framing), keeping the SAME publish date.
//
//   node --import tsx --env-file=.env.prod scripts/fix-black-friendly-post.ts          # dry-run
//   node --import tsx --env-file=.env.prod scripts/fix-black-friendly-post.ts --apply  # write

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const NEW = {
  slug: "dubai-salon-textured-hair",
  title: "The Dubai Salon That Speaks Fluent Textured Hair",
  category: "Hair",
  targetKeyword: "textured hair salon dubai",
  tags: ["textured hair", "braids", "protective styling", "dubai salon", "afro hair care"],
  excerpt: "Coils, kinks, locs and waves each have their own rules. Here is what a salon that truly understands textured hair does differently in Dubai.",
  metaDescription: "A Dubai salon that specialises in textured hair: protective styling, hydration and climate-smart aftercare from artists who know coils and locs.",
  contentMarkdown: `Your hair has a language. Coils, kinks, waves and locs each carry their own rules for tension, moisture and heat, and most salons in Dubai politely nod before reaching for the wrong products. A few speak it fluently. You feel the difference the moment you sit in the chair.

## Textured hair needs a specialist, not a guess

Afro and textured hair is not "difficult". It is precise. Curl pattern, porosity and density decide how a style should be parted, how much tension a scalp can take and how long a look will last. Our crown artists work with this hair every day, so the plan starts before the first braid: a look at your texture, your goals and how your hair behaves in this climate.

Get that reading right and everything else follows. Get it wrong and you feel it within a week.

## Protective styling, done properly

Braids, cornrows, knotless and locs are protective styles for a reason. The point is to tuck your ends away and let your hair rest and grow, not to pull it to breaking point for the sake of a sleeker finish. Done well, a protective style shields your strands for weeks. Done badly, it thins your edges.

That is why we start with hydration, keep tension gentle and honest, and tell you the truth about how long a style should stay in before it starts working against you.

## Dubai is hard on hair, and here is what we do about it

The heat, the humidity and the hard water all leave their mark. Mineral buildup dulls curls and dries out braids, and pool chlorine is no kinder. So we prep the hair with a deep hydration treatment, and you leave with aftercare built for this city, not a generic leaflet.

| Dubai factor | What it does | What we do about it |
| --- | --- | --- |
| Hard water | Mineral buildup, dryness | Clarify, then deep-condition |
| Heat and humidity | Frizz, faster dryness | Seal moisture, lighter styling |
| Pool chlorine | Brittle, stripped hair | Pre-swim oil, post-swim rinse advice |

## What your first visit looks like

A short consultation, then a hydration treatment, then the style itself, finished with an aftercare plan you can actually follow. No rush, no guesswork, and no surprises at the mirror.

## Aftercare that holds up here

- Sleep on satin or silk to keep moisture in and frizz out.
- Moisturise your scalp and the length lightly, not heavily.
- Clarify hard-water buildup every few washes.
- Never over-tighten a fresh style to "make it last". It costs you edges.
- Rebook before the style starts to loosen, not weeks after.

When you are ready, WhatsApp us a photo of the look you want and your hair length for a quick estimate, or book online and let our crown artists take it from there.`,
};

async function main() {
  const post = await prisma.blogPost.findFirst({
    where: { title: { contains: "Black Friendly", mode: "insensitive" } },
    select: { id: true, slug: true, title: true, publishedAt: true, status: true },
  });
  if (!post) { console.log("No matching post found (already fixed?)."); return; }
  console.log(`Found: "${post.title}"  slug=${post.slug}  published=${post.publishedAt.toISOString().slice(0, 10)}  status=${post.status}`);
  console.log(`  -> "${NEW.title}"  slug=${NEW.slug}  (publish date KEPT, status KEPT)`);
  if (!APPLY) { console.log("\nDRY-RUN. Re-run with --apply to write."); return; }
  await prisma.blogPost.update({
    where: { id: post.id },
    data: {
      slug: NEW.slug, title: NEW.title, category: NEW.category, targetKeyword: NEW.targetKeyword,
      tags: NEW.tags, excerpt: NEW.excerpt, metaDescription: NEW.metaDescription, contentMarkdown: NEW.contentMarkdown,
      // publishedAt and status intentionally untouched.
    },
  });
  console.log("\n✓ Post rewritten in place (same publish date).");
}

main().finally(() => prisma.$disconnect());
