import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { monthStartUTC } from "./finance";
import { aggregateMonthly, dubaiParts, type MonthlyAnalytics } from "./analytics-core";

export type { MonthlyAnalytics };

/**
 * Dashboard analytics for the current Dubai month. FRUGAL BY DESIGN:
 * - ONE bounded query (this month's PAID orders only — never the full table),
 * - wrapped in the Next.js Data Cache with a 5-minute revalidate, so however often super-admin
 *   refreshes, the DB is hit at most once every 5 minutes per month,
 * - all six chart datasets are derived in memory (see analytics-core) from that single fetch;
 *   the client switches views with zero extra DB hits.
 */
async function compute(monthKey: string): Promise<MonthlyAnalytics> {
  const start = monthStartUTC();
  const [orders, services] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { status: "PAID", createdAt: { gte: start } },
      select: {
        totalAED: true, subtotalAED: true, vatAED: true, createdAt: true,
        paymentMethod: true, splitPayment: true, cashAED: true, cardAED: true, transferAED: true,
        lines: { select: { kind: true, description: true, lineAED: true } },
      },
    }),
    prisma.service.findMany({ select: { name: true, category: true } }),
  ]);
  const catByName = new Map(services.map((s) => [s.name, s.category]));
  return aggregateMonthly(orders, catByName, { monthKey, now: new Date() });
}

/** Cached entry point — at most one DB read per 10-min window per month (or on a new bill). */
export function getMonthlyAnalytics(): Promise<MonthlyAnalytics> {
  const monthKey = dubaiParts(new Date()).slice(0, 7); // YYYY-MM
  return unstable_cache(() => compute(monthKey), ["monthly-analytics", monthKey], {
    revalidate: 300,
  })();
}
