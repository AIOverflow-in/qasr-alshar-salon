import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { isSellable } from "./shop-core";

export type ShopCard = { id: string; name: string; category: string; priceAED: number; stock: number; imageUrl: string; description: string | null };

/**
 * Published, buyable products for the public storefront. FRUGAL: bounded (retail+active only) and
 * cached in the Next.js Data Cache (5-min revalidate) so the high-traffic homepage doesn't re-query
 * the DB on every visit. Only truly sellable items (priced + imaged + in stock) are returned.
 */
export function getPublishedProducts(): Promise<ShopCard[]> {
  return unstable_cache(
    async () => {
      const products = await prisma.product.findMany({
        where: { retail: true, active: true },
        orderBy: { name: "asc" },
        take: 200,
        select: { id: true, name: true, category: true, saleAED: true, qty: true, retail: true, active: true, imageUrl: true, description: true },
      });
      return products
        .filter((p) => isSellable(p))
        .map((p) => ({ id: p.id, name: p.name, category: p.category, priceAED: p.saleAED ?? 0, stock: p.qty, imageUrl: p.imageUrl!, description: p.description }));
    },
    ["shop-products"],
    { revalidate: 300 },
  )();
}
