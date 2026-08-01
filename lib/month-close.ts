import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { currentDubaiMonth, dubaiMonthRange, recentMonths } from "./payroll-core";
import { getPayrollMonth } from "./payroll";
import { buildMonthClose, monthsEndingAt, type MonthClose } from "./month-close-core";

export { recentMonths, currentDubaiMonth };
export type { MonthClose };

/**
 * One month-scoped picture for the dashboard "Month close" panel. FRUGAL: a couple of bounded
 * queries + payroll, wrapped in the Next Data Cache (5-min revalidate) so repeated views hit the
 * DB at most once per 5 min per month. Read-only — never touches payroll calculations.
 */
async function compute(month: string): Promise<MonthClose> {
  const { start, end } = dubaiMonthRange(month);
  const trendMonths = monthsEndingAt(month, 6); // 6 months ending at the selected month
  const trendStart = dubaiMonthRange(trendMonths[0]).start;

  const [monthOrders, trendOrders, payroll, expenseGroups] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { status: "PAID", createdAt: { gte: start, lt: end } },
      select: { createdAt: true, totalAED: true, subtotalAED: true, vatAED: true },
    }),
    prisma.salesOrder.findMany({
      where: { status: "PAID", createdAt: { gte: trendStart, lt: end } },
      select: { createdAt: true, totalAED: true },
    }),
    getPayrollMonth(month),
    prisma.expense.groupBy({ by: ["category"], where: { incurredOn: { gte: start, lt: end } }, _sum: { amountAED: true } }),
  ]);

  const owed = payroll.rows.filter((r) => r.net > 0);
  return buildMonthClose({
    month,
    isCurrent: month === currentDubaiMonth(),
    monthOrders,
    trendOrders,
    trendMonths,
    payroll: { net: payroll.totals.net, paidNet: payroll.totals.paidNet, outstandingNet: payroll.totals.outstandingNet },
    owedCount: owed.length,
    paidCount: owed.filter((r) => r.paid).length,
    expenseGroups: expenseGroups.map((e) => ({ category: e.category, amountAED: e._sum.amountAED ?? 0 })),
  });
}

export function getMonthClose(monthISO?: string): Promise<MonthClose> {
  const month = monthISO && /^\d{4}-\d{2}$/.test(monthISO) ? monthISO : currentDubaiMonth();
  return unstable_cache(() => compute(month), ["month-close", month], { revalidate: 300 })();
}
