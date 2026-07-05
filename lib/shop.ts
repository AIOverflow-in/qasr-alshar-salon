import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { isSellable } from "./shop-core";

export type ShopCard = { id: string; slug: string; name: string; category: string; priceAED: number; stock: number; imageUrl: string; description: string | null };

/**
 * Published, buyable products for the public storefront. FRUGAL: bounded (retail+active only) and
 * cached in the Next.js Data Cache (5-min revalidate) so the high-traffic homepage / shop page don't
 * re-query the DB on every visit. Only truly sellable items (priced + imaged + in stock) are returned.
 */
export function getPublishedProducts(): Promise<ShopCard[]> {
  return unstable_cache(
    async () => {
      const products = await prisma.product.findMany({
        where: { retail: true, active: true },
        orderBy: { name: "asc" },
        take: 200,
        select: { id: true, slug: true, name: true, category: true, saleAED: true, qty: true, retail: true, active: true, imageUrl: true, description: true },
      });
      return products
        .filter((p) => isSellable(p))
        .map((p) => ({ id: p.id, slug: p.slug ?? p.id, name: p.name, category: p.category, priceAED: p.saleAED ?? 0, stock: p.qty, imageUrl: p.imageUrl!, description: p.description }));
    },
    ["shop-products"],
    { revalidate: 300 },
  )();
}

/** A single published product by slug (cached per slug). Returns null if missing or not sellable. */
export function getProductBySlug(slug: string): Promise<ShopCard | null> {
  return unstable_cache(
    async () => {
      const p = await prisma.product.findFirst({
        where: { slug, retail: true, active: true },
        select: { id: true, slug: true, name: true, category: true, saleAED: true, qty: true, retail: true, active: true, imageUrl: true, description: true },
      });
      if (!p || !isSellable(p)) return null;
      return { id: p.id, slug: p.slug ?? p.id, name: p.name, category: p.category, priceAED: p.saleAED ?? 0, stock: p.qty, imageUrl: p.imageUrl!, description: p.description };
    },
    ["shop-product", slug],
    { revalidate: 300 },
  )();
}
