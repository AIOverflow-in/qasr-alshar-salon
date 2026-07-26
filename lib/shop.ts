import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { isSellable } from "./shop-core";
import { rankProducts, assignBadges, type ShopBadge } from "./shop-rank";

export type ShopCard = {
  id: string;
  slug: string;
  name: string;
  category: string;
  priceAED: number;
  stock: number;
  imageUrl: string;
  description: string | null;
  unitsSold: number;   // real units sold (POS + online) — drives "best-selling first"
  badge: ShopBadge;    // "bestseller" (genuinely sold) | "popular" (top in-demand pick) | null
};

/**
 * Real units sold per product: in-salon POS product lines (PAID) + online storefront orders
 * (line items are snapshotted as JSON, so we tally them in code). Bounded + only run on a cache
 * miss, so this stays cheap. This is the genuine "top-selling" signal used to rank the shop.
 */
async function unitsSoldByProduct(ids: string[]): Promise<Map<string, number>> {
  const sold = new Map<string, number>();
  if (!ids.length) return sold;
  const idSet = new Set(ids);

  const pos = await prisma.orderLine.groupBy({
    by: ["productId"],
    where: { kind: "PRODUCT", productId: { in: ids }, order: { status: "PAID" } },
    _sum: { qty: true },
  });
  for (const r of pos) if (r.productId) sold.set(r.productId, (sold.get(r.productId) ?? 0) + (r._sum.qty ?? 0));

  const online = await prisma.shopOrder.findMany({
    where: { status: { not: "CANCELLED" } },
    select: { items: true },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  for (const o of online) {
    const items = Array.isArray(o.items) ? (o.items as Array<{ productId?: unknown; qty?: unknown }>) : [];
    for (const it of items) {
      const pid = it && typeof it.productId === "string" ? it.productId : null;
      if (pid && idSet.has(pid)) sold.set(pid, (sold.get(pid) ?? 0) + (Number(it.qty) || 0));
    }
  }
  return sold;
}

/**
 * Published, buyable products for the public storefront, ordered best-selling first. FRUGAL: bounded
 * (retail+active only) and cached in the Next.js Data Cache (5-min revalidate) so the high-traffic
 * homepage / shop page don't re-query the DB on every visit. Only truly sellable items (priced +
 * imaged + in stock) are returned; ranking + labels come from lib/shop-rank.
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
      const sellable = products.filter((p) => isSellable(p));
      const sold = await unitsSoldByProduct(sellable.map((p) => p.id));
      const cards: ShopCard[] = sellable.map((p) => ({
        id: p.id,
        slug: p.slug ?? p.id,
        name: p.name,
        category: p.category,
        priceAED: p.saleAED ?? 0,
        stock: p.qty,
        imageUrl: p.imageUrl!,
        description: p.description,
        unitsSold: sold.get(p.id) ?? 0,
        badge: null,
      }));
      return assignBadges(rankProducts(cards));
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
      return { id: p.id, slug: p.slug ?? p.id, name: p.name, category: p.category, priceAED: p.saleAED ?? 0, stock: p.qty, imageUrl: p.imageUrl!, description: p.description, unitsSold: 0, badge: null };
    },
    ["shop-product", slug],
    { revalidate: 300 },
  )();
}

/**
 * A product for its detail PAGE — like getProductBySlug but keeps OUT-OF-STOCK items (still
 * published, priced, imaged), so a sold-out product shows a "sold out" state instead of a hard
 * 404 (preserves the URL for Google + shared links). Stock is surfaced via `stock` so the page
 * gates buying.
 */
export function getProductForPage(slug: string): Promise<ShopCard | null> {
  return unstable_cache(
    async () => {
      const p = await prisma.product.findFirst({
        where: { slug, retail: true, active: true },
        select: { id: true, slug: true, name: true, category: true, saleAED: true, qty: true, imageUrl: true, description: true },
      });
      if (!p || !p.imageUrl || (p.saleAED ?? 0) <= 0) return null; // viewable = published + priced + imaged
      return { id: p.id, slug: p.slug ?? p.id, name: p.name, category: p.category, priceAED: p.saleAED ?? 0, stock: p.qty, imageUrl: p.imageUrl, description: p.description, unitsSold: 0, badge: null };
    },
    ["shop-product-page", slug],
    { revalidate: 300 },
  )();
}

/** A few other in-stock products to suggest on a detail page — same category first, then the rest. */
export async function getRelatedProducts(category: string, excludeId: string, limit = 4): Promise<ShopCard[]> {
  const all = await getPublishedProducts();
  const sameCat = all.filter((p) => p.category === category && p.id !== excludeId);
  const others = all.filter((p) => p.category !== category && p.id !== excludeId);
  return [...sameCat, ...others].slice(0, limit);
}
