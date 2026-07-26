// Pure storefront ranking + labels (unit-tested in lib/shop-rank.test.ts).
//
// Goal: show the best-selling products first instead of alphabetically. Genuine sales (units sold
// across POS + online) ALWAYS win. Until a product has actually sold, a transparent market-popularity
// heuristic (product KIND + in-demand style keywords) keeps the shop sensibly merchandised — we never
// invent per-item sales figures. As real orders come in, true bestsellers float to the top on their own.

export type Rankable = {
  name: string;
  category: string;
  description?: string | null;
  unitsSold: number; // real units sold (POS + online), 0 until it sells
  stock: number;
};

export type ShopBadge = "bestseller" | "popular" | null;

/** How in-demand a product KIND is in the hair market (hero wigs lead; edge/aftercare are add-ons). */
export function categoryWeight(category: string): number {
  const c = (category || "").toLowerCase();
  if (/wig|lace|closure|frontal/.test(c)) return 50; // hero product, most-searched
  if (/bundle|weav|extension/.test(c)) return 40;
  if (/hair/.test(c)) return 35;
  if (/accessor|edge|gel|spray|oil|serum|care|after/.test(c)) return 30;
  return 25;
}

/** In-demand textures/colours score higher; novelty/specialty shades sink toward the bottom. */
export function styleScore(text: string): number {
  const t = (text || "").toLowerCase();
  let s = 0;
  if (/body wave|straight/.test(t)) s = Math.max(s, 6);
  if (/deep wave|curl|coil|wavy|bounce/.test(t)) s = Math.max(s, 5);
  if (/bob/.test(t)) s = Math.max(s, 4);
  if (/black|natural|brown|brunette/.test(t)) s = Math.max(s, 3);
  if (/blonde|honey|caramel|chocolate|mocha/.test(t)) s = Math.max(s, 2);
  if (/ombre|ginger|ash|highlight|burgundy|\bred\b|grey|gray|blue|pink|green/.test(t)) s = Math.max(s, 1);
  return s;
}

/** Composite popularity: real sales dominate (a single sale outranks any heuristic tier), then demand. */
export function popularityScore(p: Rankable): number {
  return p.unitsSold * 1000 + categoryWeight(p.category) + styleScore(`${p.name} ${p.description ?? ""}`);
}

/** Order the storefront: in-stock first, then most popular, stable by name. */
export function rankProducts<T extends Rankable>(products: T[]): T[] {
  return [...products].sort((a, b) => {
    const inStock = (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0);
    if (inStock) return inStock;                       // sold-out sinks to the bottom
    const byPop = popularityScore(b) - popularityScore(a);
    if (byPop) return byPop;                           // most popular first
    return a.name.localeCompare(b.name);               // stable, predictable
  });
}

/**
 * Assign at most a handful of honest badges to an already-ranked list:
 *  - "Bestseller": the product has genuinely sold (top real sellers, capped at 8).
 *  - "Popular": an editorial highlight for a top-ranked pick that is a genuinely in-demand kind/style
 *    (only near the top, and only when the heuristic — not mere alphabetical luck — says it's popular).
 */
export function assignBadges<T extends Rankable>(ranked: T[]): (T & { badge: ShopBadge })[] {
  let bestsellersLeft = 8;
  return ranked.map((p, i) => {
    let badge: ShopBadge = null;
    if (p.unitsSold > 0 && bestsellersLeft > 0) {
      badge = "bestseller";
      bestsellersLeft--;
    } else if (i < 6 && p.stock > 0 && (categoryWeight(p.category) >= 40 || styleScore(`${p.name} ${p.description ?? ""}`) >= 4)) {
      badge = "popular";
    }
    return { ...p, badge };
  });
}
