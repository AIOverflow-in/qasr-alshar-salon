import "server-only";
import { prisma } from "./prisma";
import { monthStartUTC, dubaiDayRange, dubaiRangeForDate, salesRange, type DayRange } from "./finance-core";

// Pure date/range helpers now live in finance-core (unit-tested there); re-exported so existing
// `@/lib/finance` importers (sales/erp/calendar/bookings pages, cron, digest, analytics) are unchanged.
export { monthStartUTC, dubaiDayRange, dubaiRangeForDate, salesRange, type DayRange };

export type RevenueSummary = {
  gross: number; // total incl. VAT — the money actually received
  net: number; // subtotal ex-VAT — true sales revenue
  vat: number; // VAT collected (held for the tax authority)
  orders: number; // number of paid invoices
};

/**
 * Real revenue from POS sales orders (status = PAID) since `since`.
 * This is the single source of truth for money taken — every bill counts here,
 * whether it came from a walk-in, a booking, or a retail sale.
 */
export async function getRevenueSince(since: Date): Promise<RevenueSummary> {
  const agg = await prisma.salesOrder.aggregate({
    _sum: { totalAED: true, subtotalAED: true, vatAED: true },
    _count: true,
    where: { status: "PAID", createdAt: { gte: since } },
  });
  return {
    gross: agg._sum.totalAED ?? 0,
    net: agg._sum.subtotalAED ?? 0,
    vat: agg._sum.vatAED ?? 0,
    orders: agg._count ?? 0,
  };
}

/** Revenue for the current Dubai month. */
export async function getMonthlyRevenue(): Promise<RevenueSummary> {
  return getRevenueSince(monthStartUTC());
}

export type SalesBreakdown = {
  count: number; total: number; net: number; vat: number;
  byMethod: { CASH: number; CARD: number; TRANSFER: number };
};

/** Accurate PAID totals for a window, split by payment method (covers the whole period). */
export async function getSalesBreakdown(range: DayRange): Promise<SalesBreakdown> {
  const where = { status: "PAID" as const, createdAt: { gte: range.start, lt: range.end } };
  const [grouped, split] = await Promise.all([
    // Single-method bills: the whole total belongs to paymentMethod.
    prisma.salesOrder.groupBy({
      by: ["paymentMethod"],
      where: { ...where, splitPayment: false },
      _sum: { totalAED: true, subtotalAED: true, vatAED: true },
      _count: true,
    }),
    // Split bills: each method's takings come from its own column.
    prisma.salesOrder.aggregate({
      where: { ...where, splitPayment: true },
      _sum: { totalAED: true, subtotalAED: true, vatAED: true, cashAED: true, cardAED: true, transferAED: true },
      _count: true,
    }),
  ]);

  const out: SalesBreakdown = { count: 0, total: 0, net: 0, vat: 0, byMethod: { CASH: 0, CARD: 0, TRANSFER: 0 } };
  for (const g of grouped) {
    const t = g._sum.totalAED ?? 0;
    out.count += g._count;
    out.total += t;
    out.net += g._sum.subtotalAED ?? 0;
    out.vat += g._sum.vatAED ?? 0;
    if (g.paymentMethod in out.byMethod) out.byMethod[g.paymentMethod as keyof SalesBreakdown["byMethod"]] += t;
  }
  out.count += split._count;
  out.total += split._sum.totalAED ?? 0;
  out.net += split._sum.subtotalAED ?? 0;
  out.vat += split._sum.vatAED ?? 0;
  out.byMethod.CASH += split._sum.cashAED ?? 0;
  out.byMethod.CARD += split._sum.cardAED ?? 0;
  out.byMethod.TRANSFER += split._sum.transferAED ?? 0;
  return out;
}

export type RevenueByKind = { service: number; product: number; total: number };
/** Split PAID takings into service vs product revenue for a window (by OrderLine.kind, gross lineAED). */
export async function getRevenueByKind(range: DayRange): Promise<RevenueByKind> {
  const grouped = await prisma.orderLine.groupBy({
    by: ["kind"],
    where: { order: { status: "PAID", createdAt: { gte: range.start, lt: range.end } } },
    _sum: { lineAED: true },
  });
  const out: RevenueByKind = { service: 0, product: 0, total: 0 };
  for (const g of grouped) {
    const sum = g._sum.lineAED ?? 0;
    if (g.kind === "PRODUCT") out.product += sum;
    else out.service += sum;
  }
  out.total = out.service + out.product;
  return out;
}
