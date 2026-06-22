import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES } from "../lib/services";
import { slugify } from "../lib/utils";

const prisma = new PrismaClient();

const STAFF = JSON.parse(
  readFileSync(join(__dirname, "data/staff.json"), "utf8")
) as { name: string; role: string; hours: string; offDay: string }[];
const PRODUCTS = JSON.parse(
  readFileSync(join(__dirname, "data/products.json"), "utf8")
) as { barcode: string; category: string; name: string; qty: number }[];

const BLOG_TOPICS = [
  { title: "How to Care for Knotless Braids in Dubai's Climate", keywords: ["knotless braids Dubai", "braid care", "protective styling"] },
  { title: "Bridal Henna Trends UAE Brides Are Loving This Year", keywords: ["bridal henna Dubai", "mehndi trends", "wedding henna"] },
  { title: "Sew-In vs Wig: Which Is Right for You?", keywords: ["sew in Dubai", "wig installation", "weave"] },
  { title: "Keratin vs Hair Botox: A Complete Guide", keywords: ["keratin Dubai", "hair botox", "smoothing treatment"] },
  { title: "How Often Should You Get a Facial? A Dubai Skincare Guide", keywords: ["facial Dubai", "hydra facial", "skincare routine"] },
  { title: "Making Your Gel Manicure Last Longer", keywords: ["gel nails Dubai", "manicure tips", "nail care"] },
  { title: "Bridal Beauty Timeline: Your Wedding Countdown", keywords: ["bridal makeup Dubai", "wedding beauty", "bridal prep"] },
  { title: "Sisterlocks 101: Everything You Need to Know", keywords: ["sisterlocks Dubai", "locs", "natural hair"] },
  { title: "Lash Extensions Aftercare: Do's and Don'ts", keywords: ["eyelash extensions Dubai", "lash care", "lash aftercare"] },
  { title: "Protective Hairstyles for the Summer Heat", keywords: ["protective styles", "summer hair Dubai", "braids"] },
  { title: "Choosing the Right Makeup for Dubai Weddings", keywords: ["wedding makeup Dubai", "glam makeup", "makeup artist"] },
  { title: "The Art of Henna: Styles for Every Occasion", keywords: ["henna designs", "mehndi Dubai", "henna art"] },
];

async function main() {
  console.log("→ Seeding services …");
  let order = 0;
  for (const cat of CATEGORIES) {
    for (const item of cat.items) {
      const slug = slugify(`${cat.slug}-${item.name}`);
      await prisma.service.upsert({
        where: { slug },
        update: {
          name: item.name,
          category: cat.name,
          categorySlug: cat.slug,
          priceAED: item.price,
          durationMin: item.duration,
          order: order++,
          active: true,
        },
        create: {
          name: item.name,
          slug,
          category: cat.name,
          categorySlug: cat.slug,
          priceAED: item.price,
          durationMin: item.duration,
          order: order++,
        },
      });
    }
  }
  console.log(`  ✓ ${order} services`);

  console.log("→ Seeding working hours (10:00–22:00 daily) …");
  for (let weekday = 0; weekday < 7; weekday++) {
    await prisma.workingHours.upsert({
      where: { weekday },
      update: {},
      create: { weekday, open: "10:00", close: "22:00", closed: false },
    });
  }

  console.log("→ Seeding salon settings …");
  await prisma.salonSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", capacity: 3, slotMinutes: 30, leadTimeMinutes: 60, maxAdvanceDays: 60 },
  });

  console.log("→ Seeding admin user …");
  const email = process.env.ADMIN_EMAIL;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (email && passwordHash) {
    await prisma.adminUser.upsert({
      where: { email },
      update: { passwordHash, role: "SUPER_ADMIN" },
      create: { email, passwordHash, name: "Salon Admin", role: "SUPER_ADMIN" },
    });
    console.log(`  ✓ admin: ${email}`);
  } else {
    console.warn("  ! ADMIN_EMAIL / ADMIN_PASSWORD_HASH not set — skipped admin seed");
  }

  console.log("→ Seeding staff (Crown Artists) …");
  for (let i = 0; i < STAFF.length; i++) {
    const s = STAFF[i];
    const existing = await prisma.staff.findFirst({ where: { name: s.name } });
    const data = {
      name: s.name,
      role: s.role || "Crown Artist",
      hours: s.hours || "10:00AM - 10:00PM",
      offDay: s.offDay || null,
      order: i,
    };
    if (existing) await prisma.staff.update({ where: { id: existing.id }, data });
    else await prisma.staff.create({ data });
  }
  console.log(`  ✓ ${STAFF.length} staff`);

  console.log("→ Seeding inventory products …");
  const productCount = await prisma.product.count();
  if (productCount === 0) {
    await prisma.product.createMany({
      data: PRODUCTS.map((p) => ({
        barcode: p.barcode || null,
        name: p.name.slice(0, 200),
        category: p.category || "Retail / Aftercare",
        qty: p.qty || 0,
        retail: /retail|aftercare/i.test(p.category),
      })),
    });
    console.log(`  ✓ ${PRODUCTS.length} products`);
  } else {
    console.log(`  · ${productCount} products already present`);
  }

  console.log("→ Seeding blog topics …");
  const existing = await prisma.blogTopic.count();
  if (existing === 0) {
    await prisma.blogTopic.createMany({
      data: BLOG_TOPICS.map((t) => ({ title: t.title, keywords: t.keywords })),
    });
    console.log(`  ✓ ${BLOG_TOPICS.length} topics`);
  } else {
    console.log(`  · ${existing} topics already present`);
  }

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
