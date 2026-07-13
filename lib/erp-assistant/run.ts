import "server-only";
import { prisma } from "../prisma";
import { salesRange, getSalesBreakdown } from "../finance";
import type { IntentId, RangeParams } from "./intents";

// Executes a validated intent against the DB. READ-ONLY by construction — every
// branch is a hand-written findMany/groupBy/aggregate/count; there is no code
// path that writes. Money follows the ERP's rules: PAID orders only, Dubai-time
// windows via salesRange, and the stored net/VAT/gross columns (see lib/finance).

export type QueryResult = Record<string, unknown>;

export async function runIntent(intent: IntentId, params: { range: RangeParams; limit: number }): Promise<QueryResult> {
  const { range, limit } = params;

  switch (intent) {
    case "takings": {
      const b = await getSalesBreakdown(salesRange(range));
      return { window: range, total: b.total, net: b.net, vat: b.vat, count: b.count, byMethod: b.byMethod };
    }

    case "top_services":
    case "top_products": {
      const w = salesRange(range);
      const kind = intent === "top_services" ? "SERVICE" : "PRODUCT";
      const grouped = await prisma.orderLine.groupBy({
        by: ["description"],
        where: { kind, order: { status: "PAID", createdAt: { gte: w.start, lt: w.end } } },
        _sum: { qty: true, lineAED: true },
      });
      const rows = grouped
        .map((g) => ({ name: g.description, qty: g._sum.qty ?? 0, revenue: g._sum.lineAED ?? 0 }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
      return { window: range, rows };
    }

    case "staff_performance": {
      const w = salesRange(range);
      const [grouped, staff] = await Promise.all([
        prisma.commission.groupBy({
          by: ["staffId"],
          where: { createdAt: { gte: w.start, lt: w.end } },
          _sum: { baseAED: true, amountAED: true },
        }),
        prisma.staff.findMany({ select: { id: true, name: true } }),
      ]);
      const nameOf = new Map(staff.map((s) => [s.id, s.name]));
      const rows = grouped
        .map((g) => ({ name: nameOf.get(g.staffId) ?? "Unknown", services: g._sum.baseAED ?? 0, commission: g._sum.amountAED ?? 0 }))
        .sort((a, b) => b.services - a.services);
      return { window: range, rows };
    }

    case "low_stock": {
      // reorderAt isn't a column we can compare to qty inside `where`, so filter in code.
      const products = await prisma.product.findMany({
        where: { active: true },
        select: { name: true, qty: true, reorderAt: true },
        orderBy: { qty: "asc" },
      });
      const rows = products.filter((p) => p.qty <= p.reorderAt).map((p) => ({ name: p.name, qty: p.qty, reorderAt: p.reorderAt }));
      return { rows };
    }

    case "expenses_summary": {
      const w = salesRange(range);
      const grouped = await prisma.expense.groupBy({
        by: ["category"],
        where: { incurredOn: { gte: w.start, lt: w.end } },
        _sum: { amountAED: true },
      });
      const rows = grouped
        .map((g) => ({ category: g.category, total: g._sum.amountAED ?? 0 }))
        .sort((a, b) => b.total - a.total);
      const total = rows.reduce((s, r) => s + r.total, 0);
      return { window: range, rows, total };
    }

    case "bookings_summary": {
      const w = salesRange(range);
      const [grouped, upcoming] = await Promise.all([
        prisma.booking.groupBy({ by: ["status"], where: { startAt: { gte: w.start, lt: w.end } }, _count: true }),
        prisma.booking.count({ where: { startAt: { gte: new Date() }, status: "CONFIRMED" } }),
      ]);
      const byStatus: Record<string, number> = {};
      let total = 0;
      for (const g of grouped) { byStatus[g.status] = g._count; total += g._count; }
      return { window: range, byStatus, total, upcoming };
    }

    case "top_clients": {
      const clients = await prisma.client.findMany({
        orderBy: { totalSpentAED: "desc" },
        take: limit,
        select: { name: true, visits: true, totalSpentAED: true },
      });
      return { rows: clients.map((c) => ({ name: c.name, visits: c.visits, spent: c.totalSpentAED })) };
    }
  }

  return { rows: [] };
}
