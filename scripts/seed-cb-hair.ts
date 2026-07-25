// Seeds the full Chrissy Bales HAIR catalogue (74 wigs + 8 bundles + 3 edge
// controls) as products: their product names, ORIGINAL (templated) descriptions,
// prices converted GBP->AED, and generated in-style images mapped by colour/texture
// (we never reuse their photos). Reads /tmp/cb_hair.json. Idempotent (upsert by slug).
//
//   node --import tsx --env-file=.env.prod scripts/seed-cb-hair.ts          # dry-run
//   node --import tsx --env-file=.env.prod scripts/seed-cb-hair.ts --apply  # write

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const GBP_TO_AED = 4.63;
const STOCK = 10;

type Row = { title: string; type: string; gbp: number; colour: string; texture: string };
const rows: Row[] = JSON.parse(readFileSync("/tmp/cb_hair.json", "utf8"));

const slugify = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const aed = (gbp: number) => Math.max(50, Math.round((gbp * GBP_TO_AED) / 5) * 5);
const texKind = (t: string) => (/bob/.test(t) ? "bob" : /curl|coil|bounc/.test(t) ? "curly" : /wave|wavy|body/.test(t) ? "wave" : "straight");

function wigImage(colour: string, texture: string) {
  const tex = texKind(texture);
  if (colour === "black") return `look-black-${tex}`;
  if (colour === "blonde") return tex === "straight" ? "look-blonde-straight" : "look-blonde-wave";
  if (colour === "honey") return "look-honey-wave";
  if (colour === "ash") return "look-ash-wave";
  if (colour === "ombre") return "look-ombre-wave";
  if (colour === "ginger") return "look-ginger-wave";
  if (colour === "highlight") return "look-highlight-straight";
  if (["caramel", "cappuccino", "mocha", "chocolate", "vanilla"].includes(colour)) return "look-caramel-wave";
  if (colour === "cinnamon") return "look-brown-straight";
  if (colour === "chai") return "look-brown-curly";
  return `look-black-${tex}`;
}
function bundleImage(title: string) {
  const t = title.toLowerCase();
  if (/closure|frontal/.test(t)) return "bundle-closure";
  if (/wave|wavy/.test(t)) return "bundle-body-wave";
  return "bundle-straight";
}

const texLine: Record<string, string> = {
  straight: "Glossy, sleek and effortless, it holds a press and takes colour beautifully.",
  wave: "Soft, voluminous waves with natural movement that bounce back after every wash.",
  curly: "Bouncy, defined curls with natural body that revive with water and a little product.",
  bob: "A sharp, modern shoulder-length cut that frames the face.",
};

// Non-products in the feed (builders, option pickers, packaging, services).
const SKIP = /create your own|packaging|gift card|shop looks|^ss25|options$|customisation|processing time|private fitting|styling only|revamp|replacement service|consultation|subscription|new hair length|hair (length|colour|texture|density)/i;
const cleanName = (t: string) => t.replace(/\bCB\b/gi, "").replace(/\s+/g, " ").trim().replace(/^\w/, (c) => c.toUpperCase());

function describe(r: Row, name: string): string {
  if (r.type === "Accessories") return "Tames and lays your edges with a firm, long-lasting, flake-free hold and a healthy shine. Water-based, non-greasy and kind to your hairline.";
  if (r.type === "Bundles") return `${name} in 100% raw virgin human hair. ${texLine[texKind(r.texture)]} Double-drawn and full from root to tip, available in multiple lengths.`;
  return `${name} is a ${r.colour === "black" ? "" : r.colour + " "}${texKind(r.texture)} lace-front wig in 100% human hair, pre-plucked with a natural hairline that melts into the skin. ${texLine[texKind(r.texture)]} Ready to wear, with customisable length and cap size.`;
}

// The 14 generic interim drafts to remove (superseded by CB's real catalogue).
const CLEANUP = ["raw-straight-bundle", "raw-body-wave-bundle", "peruvian-body-wave-bundle", "raw-loose-wave-bundle", "raw-deep-wave-bundle", "raw-water-wave-bundle", "raw-curly-bundle", "raw-kinky-curly-bundle", "raw-kinky-straight-bundle", "raw-hd-lace-closure", "straight-lace-front-wig", "body-wave-lace-front-wig", "curly-lace-front-wig", "straight-bob-hd-wig"];

async function main() {
  console.log(`${rows.length} CB hair products · mode=${APPLY ? "APPLY" : "DRY-RUN"}\n`);
  if (APPLY) {
    const del = await prisma.product.deleteMany({ where: { slug: { in: CLEANUP }, orderLines: { none: {} } } });
    console.log(`removed ${del.count} interim placeholder drafts\n`);
  }
  const used = new Set<string>();
  let created = 0, skipped = 0;
  for (const r of rows) {
    if (SKIP.test(r.title)) { skipped++; continue; }
    const name = cleanName(r.title);
    let slug = slugify(name);
    while (used.has(slug)) slug += "-x";
    used.add(slug);
    const category = r.type === "Named Wig Unit" ? "Wigs" : r.type === "Bundles" ? "Hair Extensions" : "Accessories";
    const image = r.type === "Named Wig Unit" ? wigImage(r.colour, r.texture) : r.type === "Bundles" ? bundleImage(r.title) : "look-edge-control";
    const price = aed(r.gbp || 40);
    const exists = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (exists) { skipped++; continue; }
    if (created < 6 || !APPLY) console.log(`  + ${name.slice(0, 26).padEnd(26)} ${category.padEnd(15)} AED ${String(price).padEnd(5)} /products/${image}.jpg`);
    if (APPLY) {
      await prisma.product.create({
        data: { name, slug, category, description: describe(r, name), imageUrl: `/products/${image}.jpg`, saleAED: price, qty: STOCK, retail: true, active: true },
      });
    }
    created++;
  }
  console.log(`\n${APPLY ? "Created" : "Would create"}: ${created} · skipped (exist): ${skipped}`);
}

main().finally(() => prisma.$disconnect());
