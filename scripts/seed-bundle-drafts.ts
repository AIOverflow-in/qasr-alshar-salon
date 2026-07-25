// Seeds the raw hair-bundle catalogue as DRAFT products (idempotent, upsert by slug).
// Draft = retail:false (Hidden from the storefront) + active:true (visible in the
// ERP catalogue so you can set a price and toggle "Published"). Prices are left
// null on purpose — you set them. Descriptions are original; images are generated.
//
//   node --import tsx --env-file=.env.prod scripts/seed-bundle-drafts.ts          # dry-run
//   node --import tsx --env-file=.env.prod scripts/seed-bundle-drafts.ts --apply  # write

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const CATEGORY = "Hair Extensions";

const PRODUCTS: { slug: string; name: string; image: string; description: string; category?: string }[] = [
  { slug: "raw-straight-bundle", name: "Raw Straight Bundle", image: "bundle-straight",
    description: "100% raw virgin human hair in a sleek, bone-straight finish. Soft and tangle-free, it holds a flat-iron press, takes colour like a dream and stays full from root to tip. Ethically sourced single-donor hair. Available 12 to 30 inches." },
  { slug: "raw-body-wave-bundle", name: "Raw Body Wave Bundle", image: "bundle-body-wave",
    description: "Effortless, glamorous movement in 100% raw virgin hair. Soft S-shaped waves that bounce back after every wash and blend seamlessly with natural texture. A salon favourite for a red-carpet finish. Available 12 to 30 inches." },
  { slug: "peruvian-body-wave-bundle", name: "Peruvian Body Wave Bundle", image: "bundle-body-wave",
    description: "Our Peruvian-style body wave in 100% raw virgin hair. Thick, coarse and full-bodied with soft waves that hold, ideal for voluminous, long-lasting installs. Available 12 to 30 inches." },
  { slug: "raw-loose-wave-bundle", name: "Raw Loose Wave Bundle", image: "bundle-loose-wave",
    description: "Relaxed, airy waves in 100% raw virgin human hair. Light and breathable with a natural swing, it is the easy everyday luxury that looks styled with almost no effort. Available 12 to 30 inches." },
  { slug: "raw-deep-wave-bundle", name: "Raw Deep Wave Bundle", image: "bundle-deep-wave",
    description: "Deep, defined waves in 100% raw virgin hair that hold their pattern wash after wash. Rich, full and dramatic, with the softness only genuine raw hair delivers. Available 12 to 30 inches." },
  { slug: "raw-water-wave-bundle", name: "Raw Water Wave Bundle", image: "bundle-water-wave",
    description: "Flowing, cascading water-wave texture in 100% raw virgin human hair. Wet-look ripples that stay defined and full, for a fresh-from-the-beach finish that lasts. Available 12 to 30 inches." },
  { slug: "raw-curly-bundle", name: "Raw Curly Bundle", image: "bundle-curly",
    description: "Bouncy, spiral curls in 100% raw virgin human hair. Springy and full with a natural sheen, it revives with water and a little product for months of wear. Available 12 to 28 inches." },
  { slug: "raw-kinky-curly-bundle", name: "Raw Kinky Curly Bundle", image: "bundle-kinky-curly",
    description: "Tight, natural kinky-curly texture in 100% raw virgin hair, made to blend with 4A to 4C natural hair. Full, voluminous and protective-style ready. Available 12 to 24 inches." },
  { slug: "raw-kinky-straight-bundle", name: "Raw Kinky Straight Bundle", image: "bundle-straight",
    description: "Natural kinky-straight texture in 100% raw virgin hair, matching blown-out natural hair beautifully. Soft, full and easy to blend for a seamless leave-out. Available 12 to 28 inches." },
  { slug: "raw-hd-lace-closure", name: "Raw HD Lace Closure", image: "bundle-closure",
    description: "A raw virgin human hair HD lace closure for a flawless, scalp-like parting. Melts into the skin, bleaches and tints to match, and finishes any bundle install. 5x5 HD lace, straight and customisable." },
  // Wigs by Qasr
  { slug: "straight-lace-front-wig", name: "Straight Lace-Front Wig", image: "wig-straight", category: "Wigs",
    description: "A sleek, long straight lace-front wig in 100% human hair with a natural, undetectable hairline. Pre-plucked and ready to wear, it lays flat and glossy for an effortless, glamorous finish. Customisable length and cap size." },
  { slug: "body-wave-lace-front-wig", name: "Body Wave Lace-Front Wig", image: "wig-body-wave", category: "Wigs",
    description: "A glamorous body-wave lace-front wig in 100% human hair. Soft, voluminous waves and a natural hairline that melts into the skin, for a red-carpet look you can wear every day. Customisable length and cap size." },
  { slug: "curly-lace-front-wig", name: "Curly Lace-Front Wig", image: "wig-curly", category: "Wigs",
    description: "A voluminous curly wig in 100% human hair with bouncy, defined spiral curls. Full-bodied and natural-looking, it revives with water and a little product for long-lasting wear. Customisable length and cap size." },
  { slug: "straight-bob-hd-wig", name: "Straight Bob HD-Lace Wig", image: "wig-bob", category: "Wigs",
    description: "A chic, straight HD-lace bob wig in 100% human hair. Shoulder-length, glossy and lightweight with a seamless hairline, for a sharp, modern finish. Customisable cap size." },
];

async function main() {
  console.log(`${PRODUCTS.length} draft products (category "${CATEGORY}") · mode=${APPLY ? "APPLY" : "DRY-RUN"}\n`);
  let created = 0, skipped = 0;
  for (const p of PRODUCTS) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug }, select: { id: true } });
    if (existing) { console.log(`  · ${p.name} (exists, left untouched)`); skipped++; continue; }
    console.log(`  + ${p.name}  → /products/${p.image}.jpg`);
    if (APPLY) {
      await prisma.product.create({
        data: {
          name: p.name, slug: p.slug, category: p.category ?? CATEGORY, description: p.description,
          imageUrl: `/products/${p.image}.jpg`,
          retail: false,   // DRAFT: hidden from storefront until you publish
          active: true,    // visible in the ERP catalogue to price + publish
          saleAED: null,   // you set the price
          qty: 0,
        },
      });
    }
    created++;
  }
  console.log(`\n${APPLY ? "Created" : "Would create"}: ${created} · skipped (already exist): ${skipped}`);
}

main().finally(() => prisma.$disconnect());
