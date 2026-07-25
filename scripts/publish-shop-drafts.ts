// Publish the raw-bundle + wig drafts so they appear on the storefront:
// sets a STARTER price (based on Chrissy Bales' real pricing), stock, and
// retail:true. Prices are a starting point — review/adjust in ERP → catalogue.
//
//   node --import tsx --env-file=.env.prod scripts/publish-shop-drafts.ts          # dry-run
//   node --import tsx --env-file=.env.prod scripts/publish-shop-drafts.ts --apply  # write

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const STOCK = 10;

const GBP_TO_AED = 4.63; // Chrissy Bales' store currency is GBP
// slug -> Chrissy Bales' "from" (shortest-length) price in GBP, matched by closest product.
const PRICE_GBP: Record<string, number> = {
  "raw-straight-bundle": 100,        // Peruvian Straight
  "raw-body-wave-bundle": 101,       // Peruvian Body Wave
  "peruvian-body-wave-bundle": 101,  // Peruvian Body Wave
  "raw-loose-wave-bundle": 101,      // ~ body wave
  "raw-deep-wave-bundle": 199,       // Indian Wavy
  "raw-water-wave-bundle": 199,      // Indian Wavy
  "raw-curly-bundle": 199,           // Indian Wavy
  "raw-kinky-curly-bundle": 96,      // Kinky Straight
  "raw-kinky-straight-bundle": 96,   // Kinky Straight
  "raw-hd-lace-closure": 248,        // Thin HD Lace Closure
  "straight-lace-front-wig": 2057,   // Named Wig Unit (from)
  "body-wave-lace-front-wig": 2126,  // Rich Waves
  "curly-lace-front-wig": 2532,      // Classic Cappuccino
  "straight-bob-hd-wig": 1100,       // The Bee Hive Bob
};
// Convert to AED, rounded to the nearest 5.
const PRICE: Record<string, number> = Object.fromEntries(
  Object.entries(PRICE_GBP).map(([s, gbp]) => [s, Math.round((gbp * GBP_TO_AED) / 5) * 5]),
);

async function main() {
  console.log(`Publishing ${Object.keys(PRICE).length} drafts · mode=${APPLY ? "APPLY" : "DRY-RUN"}\n`);
  let done = 0, missing = 0;
  for (const [slug, price] of Object.entries(PRICE)) {
    const p = await prisma.product.findUnique({ where: { slug }, select: { id: true, name: true, imageUrl: true } });
    if (!p) { console.log(`  ✗ ${slug} — not found`); missing++; continue; }
    console.log(`  ✓ ${p.name.padEnd(30)} £${PRICE_GBP[slug]} → AED ${price} · stock ${STOCK} · Published`);
    if (APPLY) {
      await prisma.product.update({ where: { id: p.id }, data: { saleAED: price, qty: STOCK, retail: true, active: true } });
    }
    done++;
  }
  console.log(`\n${APPLY ? "Published" : "Would publish"}: ${done} · missing: ${missing}`);
  console.log("Prices are STARTERS from Chrissy Bales' pricing — review in ERP → catalogue.");
}

main().finally(() => prisma.$disconnect());
