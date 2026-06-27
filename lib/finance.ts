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
