// Pure, dependency-free shop-browse helpers (search + category filter +
// pagination) — unit-tested in shop-browse-core.test.ts. Kept out of the client
// component so the filtering logic is testable in isolation.

export type BrowseItem = { name: string; category: string; description?: string | null };

/** Distinct, sorted, non-empty product categories. */
export function categoriesOf(products: BrowseItem[]): string[] {
  return [...new Set(products.map((p) => (p.category || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** Filter by a free-text query (name/category/description) and an optional category. */
export function filterProducts<T extends BrowseItem>(products: T[], query: string, category: string): T[] {
  const q = query.trim().toLowerCase();
  const cat = category && category !== "all" ? category : null;
  return products.filter((p) => {
    if (cat && p.category !== cat) return false;
    if (!q) return true;
    return p.name.toLowerCase().includes(q)
      || (p.category || "").toLowerCase().includes(q)
      || (p.description || "").toLowerCase().includes(q);
  });
}

/** Clamp a page into range and return that page's slice + the true page/pageCount. */
export function pageSlice<T>(items: T[], page: number, perPage: number): { items: T[]; page: number; pageCount: number } {
  const per = Math.max(1, perPage);
  const pageCount = Math.max(1, Math.ceil(items.length / per));
  const cur = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  return { items: items.slice((cur - 1) * per, cur * per), page: cur, pageCount };
}
