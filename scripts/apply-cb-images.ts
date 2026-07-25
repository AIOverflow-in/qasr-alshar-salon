// Point each imported CB product at its own downloaded image (/products/cb-<slug>.jpg),
// so every product has a distinct, matching photo. Reads /tmp/cb_images.json.
//
//   node --import tsx --env-file=.env.prod scripts/apply-cb-images.ts          # dry-run
//   node --import tsx --env-file=.env.prod scripts/apply-cb-images.ts --apply  # write

import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const imgs: { slug: string }[] = JSON.parse(readFileSync("/tmp/cb_images.json", "utf8"));

async function main() {
  let updated = 0, missingFile = 0, missingProduct = 0;
  for (const { slug } of imgs) {
    const url = `/products/cb-${slug}.jpg`;
    if (!existsSync(`public${url}`)) { missingFile++; continue; }
    if (APPLY) {
      const r = await prisma.product.updateMany({ where: { slug }, data: { imageUrl: url } });
      if (r.count) updated++; else missingProduct++;
    } else {
      const exists = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
      if (exists) updated++; else missingProduct++;
    }
  }
  console.log(`${APPLY ? "updated" : "would update"}: ${updated} · missing image file: ${missingFile} · product not found: ${missingProduct}`);
}

main().finally(() => prisma.$disconnect());
