// Pure, dependency-free pagination math — unit-tested in pagination-core.test.ts.
// Used by every ERP list page for server-side (skip/take + ?page=) pagination.

export const DEFAULT_PAGE_SIZE = 20;

/** Parse a `?page=` search param into a 1-based page number (>=1, never NaN). */
export function parsePage(v: string | string[] | undefined): number {
  const raw = Array.isArray(v) ? v[0] : v;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export type PageWindow = {
  total: number;
  size: number;
  pages: number;
  page: number;   // clamped to [1, pages]
  skip: number;   // for prisma
  take: number;   // = size
  from: number;   // 1-based index of first row on this page (0 when total==0)
  to: number;     // 1-based index of last row on this page
};

/**
 * Given a total row count, a requested page and a page size, return everything a
 * list page needs: clamped page, prisma skip/take, and the human "from–to of total".
 * Always returns pages>=1 and page within range, so an out-of-range ?page can't
 * produce a blank screen or a negative skip.
 */
export function pageWindow(total: number, page: number, size: number = DEFAULT_PAGE_SIZE): PageWindow {
  const safeSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : DEFAULT_PAGE_SIZE;
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const pages = Math.max(1, Math.ceil(safeTotal / safeSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const skip = (current - 1) * safeSize;
  return {
    total: safeTotal,
    size: safeSize,
    pages,
    page: current,
    skip,
    take: safeSize,
    from: safeTotal === 0 ? 0 : skip + 1,
    to: Math.min(skip + safeSize, safeTotal),
  };
}
