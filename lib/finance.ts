import "server-only";
import { prisma } from "./prisma";
import { monthStartUTC, dubaiDayRange, dubaiRangeForDate, salesRange, type DayRange } from "./finance-core";
import { buildProfitAndLoss, type PLReport } from "./pl-core";
import { getPayrollMonth } from "./payroll";
import { TAX } from "./tax";

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

/**
 * QuickBooks-style Profit & Loss for a window: income (service + retail) less operating expenses,
 * grouped by category, with the VAT basis driven by lib/tax.ts. Revenue counts PAID orders by
 * createdAt (matching the rest of finance); expenses count by incurredOn.
 */
export async function getProfitAndLoss(range: DayRange): Promise<PLReport> {
  const [byKind, expenses, salariesAED] = await Promise.all([
    getRevenueByKind(range),
    prisma.expense.groupBy({
      by: ["category"],
      where: { incurredOn: { gte: range.start, lt: range.end } },
      _sum: { amountAED: true },
    }),
    getSalaryCost(range),
  ]);
  return buildProfitAndLoss({
    vatRegistered: TAX.vatRegistered,
    vatPct: TAX.vatPct,
    serviceGrossAED: byKind.service,
    productGrossAED: byKind.product,
    salariesAED,
    expensesByCategory: expenses.map((e) => ({ category: e.category, amountAED: e._sum.amountAED ?? 0 })),
  });
}

/**
 * Total staff cost for a window. Payroll is calculated per Dubai month, so we sum every month the
 * range touches — the P&L periods (this/last month, year, tax period, custom) are whole months in
 * practice. Read-only: this never changes how pay is computed.
 */
async function getSalaryCost(range: DayRange): Promise<number> {
  const months = dubaiMonthsInRange(range);
  const results = await Promise.all(months.map((m) => getPayrollMonth(m)));
  return results.reduce((sum, p) => sum + p.totals.net, 0);
}

/** Every Dubai month "YYYY-MM" that overlaps the range (start inclusive, end exclusive). */
function dubaiMonthsInRange(range: DayRange): string[] {
  const key = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit" }).format(d);
  const out: string[] = [];
  // Step month by month from the range start until we pass the last day of the window.
  const last = key(new Date(range.end.getTime() - 1));
  const [sy, sm] = key(range.start).split("-").map(Number);
  for (let i = 0; i < 240; i++) {
    const d = new Date(Date.UTC(sy, sm - 1 + i, 1));
    const m = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push(m);
    if (m >= last) break;
  }
  return out;
}
