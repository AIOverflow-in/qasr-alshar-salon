import "server-only";
import { prisma } from "./prisma";
import { lineArtistIds } from "./artists";
import { netFromInclusive } from "./vat-core";

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

export type PayrollRow = {
  staffId: string;
  name: string;
  role: string;
  active: boolean;
  clientsServed: number;   // distinct clients this person served this month
  servicesAED: number;     // total service revenue this person generated, NET/ex-VAT (their "sales")
  grossAED: number;        // servicesAED including 5% VAT (the gross clients paid)
  salary: number;          // base salary — a guaranteed FLOOR
  salesCommission: number; // SALES_SPLIT (+ any INCENTIVE) commission
  referral: number;        // REFERRAL commission (marketer) — always added on top
  commission: number;      // salesCommission + referral (for display)
  bonus: number;
  deductions: number;      // advances + deductions
  net: number;             // max(salesCommission, salary) + referral + bonus − deductions
  paid: boolean;
  paidAt: string | null;
};

export type PayrollMonth = {
  month: string;
  rows: PayrollRow[];
  totals: { services: number; salary: number; commission: number; bonus: number; deductions: number; net: number; paidNet: number; outstandingNet: number };
};

/**
 * Payroll for a Dubai month, using the salon's actual pay model (from Jacqueline's sheet):
 * base salary is a guaranteed FLOOR, so an artist earns their 40% sales commission ONLY if it beats
 * their base; the marketer's referral is always added on top. Formula per staff:
 *   net = max(salesCommission, baseSalary) + referral + bonus − (advances + deductions)
 */
export async function getPayrollMonth(monthISO?: string): Promise<PayrollMonth> {
  const month = monthISO && /^\d{4}-\d{2}$/.test(monthISO) ? monthISO : currentDubaiMonth();
  const { start, end } = dubaiMonthRange(month);

  const [staff, commByType, adjByType, payments, serviceLines] = await Promise.all([
    prisma.staff.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, role: true, active: true, salaryAED: true } }),
    prisma.commission.groupBy({ by: ["staffId", "type"], _sum: { amountAED: true }, where: { createdAt: { gte: start, lt: end } } }),
    prisma.payAdjustment.groupBy({ by: ["staffId", "type"], _sum: { amountAED: true }, where: { month } }),
    prisma.payrollPayment.findMany({ where: { month } }),
    // Per-artist service revenue ("Services" column) — same attribution the commission engine uses.
    prisma.orderLine.findMany({
      where: { kind: "SERVICE", order: { status: "PAID", createdAt: { gte: start, lt: end } } },
      select: { lineAED: true, staffId: true, staffIds: true, order: { select: { staffId: true, clientId: true, id: true } } },
    }),
  ]);

  const services = new Map<string, number>();     // net (ex-VAT) service revenue per artist
  const grossServices = new Map<string, number>(); // gross (VAT-inclusive) — exact amount the client paid
  const servedClients = new Map<string, Set<string>>(); // staffId → distinct client keys
  for (const l of serviceLines) {
    const ids = lineArtistIds(l, l.order.staffId);
    if (!ids.length) continue;
    const share = netFromInclusive(l.lineAED) / ids.length; // ex-VAT; shared lines split equally
    const grossShare = l.lineAED / ids.length;
    const clientKey = l.order.clientId ?? `order:${l.order.id}`; // walk-ins (no client) count once per bill
    for (const id of ids) {
      services.set(id, (services.get(id) ?? 0) + share);
      grossServices.set(id, (grossServices.get(id) ?? 0) + grossShare);
      const set = servedClients.get(id) ?? new Set<string>();
      set.add(clientKey);
      servedClients.set(id, set);
    }
  }

  const comm = new Map<string, { sales: number; referral: number }>();
  for (const g of commByType) {
    const e = comm.get(g.staffId) ?? { sales: 0, referral: 0 };
    const amt = g._sum.amountAED ?? 0;
    if (g.type === "REFERRAL") e.referral += amt; else e.sales += amt;
    comm.set(g.staffId, e);
  }
  const adj = new Map<string, { bonus: number; deductions: number }>();
  for (const g of adjByType) {
    const e = adj.get(g.staffId) ?? { bonus: 0, deductions: 0 };
    const amt = g._sum.amountAED ?? 0;
    if (g.type === "BONUS") e.bonus += amt; else e.deductions += amt; // ADVANCE | DEDUCTION
    adj.set(g.staffId, e);
  }
  const paidMap = new Map(payments.map((p) => [p.staffId, p]));

  const rows: PayrollRow[] = staff.map((s) => {
    const c = comm.get(s.id) ?? { sales: 0, referral: 0 };
    const a = adj.get(s.id) ?? { bonus: 0, deductions: 0 };
    const commission = c.sales + c.referral;
    // Base is a floor: earn sales commission only if it beats base; referral always added on top.
    const net = Math.max(c.sales, s.salaryAED) + c.referral + a.bonus - a.deductions;
    const pay = paidMap.get(s.id);
    const servicesAED = Math.round(services.get(s.id) ?? 0);
    return {
      staffId: s.id, name: s.name, role: s.role, active: s.active,
      clientsServed: servedClients.get(s.id)?.size ?? 0,
      servicesAED,
      grossAED: Math.round(grossServices.get(s.id) ?? 0), // exact VAT-inclusive amount the client paid
      salary: s.salaryAED, salesCommission: c.sales, referral: c.referral, commission,
      bonus: a.bonus, deductions: a.deductions, net,
      paid: !!pay, paidAt: pay?.paidAt.toISOString() ?? null,
    };
  });

  const totals = rows.reduce(
    (t, r) => ({
      services: t.services + r.servicesAED,
      salary: t.salary + r.salary,
      commission: t.commission + r.commission,
      bonus: t.bonus + r.bonus,
      deductions: t.deductions + r.deductions,
      net: t.net + r.net,
      paidNet: t.paidNet + (r.paid ? r.net : 0),
      outstandingNet: t.outstandingNet + (r.paid ? 0 : r.net),
    }),
    { services: 0, salary: 0, commission: 0, bonus: 0, deductions: 0, net: 0, paidNet: 0, outstandingNet: 0 }
  );

  return { month, rows, totals };
}
