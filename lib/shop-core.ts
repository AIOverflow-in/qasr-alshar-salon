// Pure, dependency-free storefront logic (unit-tested in lib/shop-core.test.ts).

export type ShopProduct = {
  id: string;
  name: string;
  saleAED: number | null;
  qty: number;
  retail: boolean;
  active: boolean;
  imageUrl?: string | null;
};

export type CartLine = { productId: string; qty: number };

/** URL-safe slug from a product name (e.g. "Brazilian Body Wave!" → "brazilian-body-wave"). */
export function slugify(name: string): string {
  return String(name).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "product";
}

/**
 * A product is buyable on the storefront only if it's published (retail), active, has a positive
 * price and an image, and is in stock. Keeps unpriced/imageless drafts off the shop.
 */
export function isSellable(p: ShopProduct): boolean {
  return !!p.retail && p.active && (p.saleAED ?? 0) > 0 && !!p.imageUrl && p.qty > 0;
}

/** Clamp a requested quantity to what's in stock (never below 0). */
export function clampQty(requested: number, stock: number): number {
  if (!Number.isFinite(requested)) return 0;
  return Math.max(0, Math.min(Math.floor(requested), Math.max(0, stock)));
}

/**
 * Order total (AED, whole dirhams) from cart lines against a price/stock lookup. Skips items that
 * aren't sellable and clamps each line to available stock, so a stale cart can never over-order.
 */
export function orderTotal(
  lines: CartLine[],
  lookup: (id: string) => ShopProduct | undefined,
): { items: { productId: string; name: string; priceAED: number; qty: number; lineAED: number }[]; itemCount: number; totalAED: number } {
  const items: { productId: string; name: string; priceAED: number; qty: number; lineAED: number }[] = [];
  for (const line of lines) {
    const p = lookup(line.productId);
    if (!p || !isSellable(p)) continue;
    const qty = clampQty(line.qty, p.qty);
    if (qty <= 0) continue;
    const priceAED = p.saleAED ?? 0;
    items.push({ productId: p.id, name: p.name, priceAED, qty, lineAED: priceAED * qty });
  }
  const itemCount = items.reduce((s, i) => s + i.qty, 0);
  const totalAED = items.reduce((s, i) => s + i.lineAED, 0);
  return { items, itemCount, totalAED };
}
