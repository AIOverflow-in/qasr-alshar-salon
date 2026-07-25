/**
 * Pure payroll helpers — Dubai month math + the net-pay formula.
 *
 * Extracted from lib/payroll.ts (which is `server-only` + Prisma) so this money-critical
 * arithmetic is unit-testable in isolation. lib/payroll.ts re-exports everything here, so
 * existing `@/lib/payroll` imports are unchanged.
 */

/** "YYYY-MM" of the current Dubai month. */
export function currentDubaiMonth(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit" }).format(new Date());
}

/** UTC bounds [start, end) of a Dubai calendar month "YYYY-MM". */
export function dubaiMonthRange(monthISO: string): { start: Date; end: Date } {
  const [y, m] = monthISO.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1) - 4 * 3600_000);
  const end = new Date(Date.UTC(y, m, 1) - 4 * 3600_000);
  return { start, end };
}

/** Last `n` months (newest first) as "YYYY-MM", for the month picker. */
export function recentMonths(n = 12): string[] {
  const now = currentDubaiMonth();
  const [y, m] = now.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * Net pay for one staff member. Base salary is a guaranteed FLOOR: an artist earns their sales
 * commission ONLY if it beats their base; the marketer's referral is always added on top.
 *   net = max(salesCommission, salary) + referral + bonus − deductions
 */
export function netPay(p: {
  salesCommission: number;
  salary: number;
  referral: number;
  bonus: number;
  deductions: number;
}): number {
  return Math.max(p.salesCommission, p.salary) + p.referral + p.bonus - p.deductions;
}
