/**
 * Pure finance helpers — Dubai day/month windows + the Sales-page range resolver.
 *
 * Extracted from lib/finance.ts (which is `server-only` + Prisma) so this date math is
 * unit-testable in isolation. lib/finance.ts re-exports everything here, so existing
 * `@/lib/finance` imports are unchanged. Dubai is UTC+4 with no DST, hence the fixed −4h offset.
 */

export type DayRange = { start: Date; end: Date };

/** Start of the current month in Dubai time, returned as a UTC Date. */
export function monthStartUTC(d = new Date()) {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - 4 * 3600_000);
}

/** Start/end (as UTC instants) of a Dubai calendar day, offset from today by `offsetDays`. */
export function dubaiDayRange(offsetDays = 0): DayRange {
  const todayISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = todayISO.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d + offsetDays) - 4 * 3600_000);
  return { start, end: new Date(start.getTime() + 24 * 3600_000) };
}

/** Start/end (as UTC instants) of a specific Dubai calendar date "YYYY-MM-DD". */
export function dubaiRangeForDate(dateISO: string): DayRange {
  const [y, m, d] = dateISO.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) - 4 * 3600_000);
  return { start, end: new Date(start.getTime() + 24 * 3600_000) };
}

/**
 * Resolve the Sales-page date window from URL params.
 * Precedence: explicit from+to range → single ?date= → named ?range= → today.
 */
export function salesRange(params: { range?: string; date?: string; from?: string; to?: string }): DayRange {
  const valid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (valid(params.from) && valid(params.to)) {
    const a = dubaiRangeForDate(params.from!);
    const b = dubaiRangeForDate(params.to!);
    return a.start <= b.start ? { start: a.start, end: b.end } : { start: b.start, end: a.end };
  }
  if (valid(params.date)) return dubaiRangeForDate(params.date!);
  switch (params.range) {
    case "yesterday": return dubaiDayRange(-1);
    case "week": return { start: dubaiDayRange(-6).start, end: dubaiDayRange(0).end };
    case "month": return { start: monthStartUTC(), end: dubaiDayRange(0).end };
    case "3m": return { start: dubaiDayRange(-89).start, end: dubaiDayRange(0).end };
    default: return dubaiDayRange(0); // today
  }
}
