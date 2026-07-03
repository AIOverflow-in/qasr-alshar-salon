import "server-only";

/** Annual paid-leave entitlement (days), once eligible. */
export const ANNUAL_LEAVE_DAYS = 21;

/** Inclusive day count between two Dubai calendar dates (a one-day leave = 1). */
export function inclusiveDays(start: Date, end: Date): number {
  const a = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const b = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

/** Whole months worked since joining. */
function monthsWorked(joinedOn: Date, asOf: Date): number {
  let m = (asOf.getUTCFullYear() - joinedOn.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - joinedOn.getUTCMonth());
  if (asOf.getUTCDate() < joinedOn.getUTCDate()) m -= 1; // not a full month yet
  return m;
}

export type LeaveSummary = {
  eligible: boolean;      // completed 12 months
  entitlement: number;    // days for the current year (0 until eligible)
  taken: number;          // approved leave days this calendar year
  remaining: number;      // entitlement − taken (never negative in display)
};

/**
 * Leave standing: 21 days/year, accruing only AFTER 12 months of service; the balance is this
 * calendar year's entitlement minus days already taken. (Simple, owner-eyeball model.)
 */
export function leaveSummary(
  joinedOn: Date | null | undefined,
  leaves: { startDate: Date; endDate: Date; days: number; type: string }[],
  asOf: Date = new Date(),
): LeaveSummary {
  const eligible = !!joinedOn && monthsWorked(joinedOn, asOf) >= 12;
  const entitlement = eligible ? ANNUAL_LEAVE_DAYS : 0;
  const year = asOf.getUTCFullYear();
  const taken = leaves
    .filter((l) => l.type === "ANNUAL" && l.startDate.getUTCFullYear() === year)
    .reduce((s, l) => s + l.days, 0);
  return { eligible, entitlement, taken, remaining: entitlement - taken };
}

/**
 * Warn when leave overlaps a peak period. December is always peak; Ramadan shifts each year, so it's
 * left as a note for the owner rather than hard-coded. Summer month-ends are also busy.
 */
export function overlapsPeak(start: Date, end: Date): boolean {
  // Any day in the range falling in December (month index 11).
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (d <= last) {
    if (d.getUTCMonth() === 11) return true;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return false;
}
