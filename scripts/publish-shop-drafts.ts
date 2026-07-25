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

// slug -> starter price (AED). Single price per product; adjust per length later.
const PRICE: Record<string, number> = {
  "raw-straight-bundle": 850,
  "raw-body-wave-bundle": 900,
  "peruvian-body-wave-bundle": 950,
  "raw-loose-wave-bundle": 900,
  "raw-deep-wave-bundle": 900,
  "raw-water-wave-bundle": 900,
  "raw-curly-bundle": 950,
  "raw-kinky-curly-bundle": 950,
  "raw-kinky-straight-bundle": 900,
  "raw-hd-lace-closure": 1200,
  "straight-lace-front-wig": 2200,
  "body-wave-lace-front-wig": 2200,
  "curly-lace-front-wig": 2200,
  "straight-bob-hd-wig": 1800,
};

async function main() {
  console.log(`Publishing ${Object.keys(PRICE).length} drafts · mode=${APPLY ? "APPLY" : "DRY-RUN"}\n`);
  let done = 0, missing = 0;
  for (const [slug, price] of Object.entries(PRICE)) {
    const p = await prisma.product.findUnique({ where: { slug }, select: { id: true, name: true, imageUrl: true } });
    if (!p) { console.log(`  ✗ ${slug} — not found`); missing++; continue; }
    console.log(`  ✓ ${p.name.padEnd(30)} AED ${price} · stock ${STOCK} · Published`);
    if (APPLY) {
      await prisma.product.update({ where: { id: p.id }, data: { saleAED: price, qty: STOCK, retail: true, active: true } });
    }
    done++;
  }
  console.log(`\n${APPLY ? "Published" : "Would publish"}: ${done} · missing: ${missing}`);
  console.log("Prices are STARTERS from Chrissy Bales' pricing — review in ERP → catalogue.");
}

main().finally(() => prisma.$disconnect());
