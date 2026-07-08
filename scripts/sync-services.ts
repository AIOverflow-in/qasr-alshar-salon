/**
 * Sync the DB `Service` table to the canonical catalogue in lib/services.ts.
 *
 *   Upsert every catalogue item by slug (create or update → active: true).
 *   By default it NEVER hides or deletes anything else — services that predate
 *   the catalogue (e.g. the old menu) stay live and bookable. Pass --prune to
 *   also deactivate (active: false — never delete) services not in the catalogue.
 *
 * Usage:
 *   tsx scripts/sync-services.ts --dry     # preview only, no writes
 *   tsx scripts/sync-services.ts           # apply (upsert-only, hides nothing)
 *   tsx scripts/sync-services.ts --prune   # also deactivate non-catalogue rows
 *
 * Point it at a DB with the standard env (.env.local for the clone, or an
 * explicit DATABASE_URL). It is idempotent — safe to run repeatedly.
 */
import { PrismaClient } from "@prisma/client";
import { CATEGORIES } from "../lib/services";
import { slugify } from "../lib/utils";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry");
const PRUNE = process.argv.includes("--prune"); // opt-in: deactivate non-catalogue services

type Row = {
  slug: string;
  name: string;
  category: string;
  categorySlug: string;
  priceAED: number;
  durationMin: number;
  description: string | null;
  order: number;
};

function catalogueRows(): Row[] {
  const rows: Row[] = [];
  let order = 0;
  for (const cat of CATEGORIES) {
    for (const item of cat.items) {
      rows.push({
        slug: slugify(`${cat.slug}-${item.name}`),
        name: item.name,
        category: cat.name,
        categorySlug: cat.slug,
        priceAED: item.price,
        durationMin: item.duration,
        description: item.note ?? null,
        order: order++,
      });
    }
  }
  return rows;
}

async function main() {
  const rows = catalogueRows();

  // Guard against a catalogue authoring bug producing duplicate slugs.
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.slug)) throw new Error(`Duplicate slug in catalogue: ${r.slug} (${r.name})`);
    seen.add(r.slug);
  }
  const newSlugs = new Set(rows.map((r) => r.slug));

  const existing = await prisma.service.findMany({
    select: { slug: true, active: true, priceAED: true, name: true, category: true },
  });
  const bySlug = new Map(existing.map((e) => [e.slug, e]));

  const toCreate = rows.filter((r) => !bySlug.has(r.slug));
  const toUpdate = rows.filter((r) => bySlug.has(r.slug));
  // Only prune when explicitly asked; by default nothing is hidden.
  const toDeactivate = PRUNE ? existing.filter((e) => e.active && !newSlugs.has(e.slug)) : [];
  const priceChanges = toUpdate.filter((r) => bySlug.get(r.slug)!.priceAED !== r.priceAED);

  console.log(`\n${DRY ? "DRY RUN — no writes" : "APPLYING"}${PRUNE ? " (--prune)" : " (upsert-only, hides nothing)"}`);
  console.log(`  catalogue items : ${rows.length}`);
  console.log(`  new (create)    : ${toCreate.length}`);
  console.log(`  existing (update): ${toUpdate.length}`);
  console.log(`  price changes   : ${priceChanges.length}`);
  console.log(`  deactivating    : ${toDeactivate.length}`);
  if (toCreate.length) console.log(`\n  + CREATE:\n${toCreate.map((r) => `    ${r.category} › ${r.name} — AED ${r.priceAED}`).join("\n")}`);
  if (toDeactivate.length) console.log(`\n  − DEACTIVATE (reversible, kept in DB):\n${toDeactivate.map((e) => `    ${e.category} › ${e.name} (AED ${e.priceAED})`).join("\n")}`);

  if (DRY) {
    await prisma.$disconnect();
    return;
  }

  // All-or-nothing: wrap the upserts + deactivation in one interactive
  // transaction so a mid-run failure never leaves the live menu half-updated
  // (mixed old/new prices, removed services still bookable). The generous
  // timeout covers ~150 sequential upserts on a cold Neon connection.
  await prisma.$transaction(
    async (tx) => {
      for (const r of rows) {
        await tx.service.upsert({
          where: { slug: r.slug },
          update: {
            name: r.name, category: r.category, categorySlug: r.categorySlug,
            priceAED: r.priceAED, durationMin: r.durationMin, description: r.description,
            order: r.order, active: true,
          },
          create: {
            slug: r.slug, name: r.name, category: r.category, categorySlug: r.categorySlug,
            priceAED: r.priceAED, durationMin: r.durationMin, description: r.description,
            order: r.order,
          },
        });
      }
      if (toDeactivate.length) {
        await tx.service.updateMany({
          where: { slug: { in: toDeactivate.map((e) => e.slug) } },
          data: { active: false },
        });
      }
    },
    { timeout: 120_000, maxWait: 15_000 }
  );

  const active = await prisma.service.count({ where: { active: true } });
  const total = await prisma.service.count();
  console.log(`\n  ✓ done — active ${active} / total ${total}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
