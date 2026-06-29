import "server-only";
import { prisma } from "./prisma";

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

export type DayRange = { start: Date; end: Date };

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

export type SalesBreakdown = {
  count: number; total: number; net: number; vat: number;
  byMethod: { CASH: number; CARD: number; TRANSFER: number };
};

/** Accurate PAID totals for a window, split by payment method (covers the whole period). */
export async function getSalesBreakdown(range: DayRange): Promise<SalesBreakdown> {
  const grouped = await prisma.salesOrder.groupBy({
    by: ["paymentMethod"],
    where: { status: "PAID", createdAt: { gte: range.start, lt: range.end } },
    _sum: { totalAED: true, subtotalAED: true, vatAED: true },
    _count: true,
  });
  const out: SalesBreakdown = { count: 0, total: 0, net: 0, vat: 0, byMethod: { CASH: 0, CARD: 0, TRANSFER: 0 } };
  for (const g of grouped) {
    const t = g._sum.totalAED ?? 0;
    out.count += g._count;
    out.total += t;
    out.net += g._sum.subtotalAED ?? 0;
    out.vat += g._sum.vatAED ?? 0;
    if (g.paymentMethod in out.byMethod) out.byMethod[g.paymentMethod as keyof SalesBreakdown["byMethod"]] = t;
  }
  return out;
}
