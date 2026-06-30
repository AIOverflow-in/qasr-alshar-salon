/**
 * Which Crown Artist ids performed a given order line.
 *
 * Mirrors the commission engine (writeCommissions in app/api/erp/pos/route.ts):
 * explicit per-line artists win; else the line's legacy single artist; else the
 * order-level artist. Keeping this in one place means the bill detail view, the
 * per-artist report, and the commission split never disagree.
 */
export function lineArtistIds(
  line: { staffIds?: string[] | null; staffId?: string | null },
  orderStaffId?: string | null,
): string[] {
  if (line.staffIds && line.staffIds.length) return line.staffIds;
  if (line.staffId) return [line.staffId];
  if (orderStaffId) return [orderStaffId];
  return [];
}

/** Distinct artist names across an order's lines, in first-seen order. */
export function orderArtistNames(
  lines: { staffIds?: string[] | null; staffId?: string | null }[],
  orderStaffId: string | null | undefined,
  nameOf: (id: string) => string | undefined,
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of lines) {
    for (const id of lineArtistIds(line, orderStaffId)) {
      if (seen.has(id)) continue;
      seen.add(id);
      const n = nameOf(id);
      if (n) names.push(n);
    }
  }
  return names;
}
