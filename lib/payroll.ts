import "server-only";
import { prisma } from "./prisma";

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
  salary: number;
  salesCommission: number; // SALES_SPLIT (+ any INCENTIVE) commission
  referral: number;        // REFERRAL commission
  commission: number;      // salesCommission + referral
  bonus: number;
  deductions: number;      // advances + deductions
  net: number;             // salary + commission + bonus − deductions
  paid: boolean;
  paidAt: string | null;
};

export type PayrollMonth = {
  month: string;
  rows: PayrollRow[];
  totals: { salary: number; commission: number; bonus: number; deductions: number; net: number; paidNet: number; outstandingNet: number };
};

/** Full additive payroll for a Dubai month: net = salary + commission + bonus − (advances+deductions). */
export async function getPayrollMonth(monthISO?: string): Promise<PayrollMonth> {
  const month = monthISO && /^\d{4}-\d{2}$/.test(monthISO) ? monthISO : currentDubaiMonth();
  const { start, end } = dubaiMonthRange(month);

  const [staff, commByType, adjByType, payments] = await Promise.all([
    prisma.staff.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, role: true, active: true, salaryAED: true } }),
    prisma.commission.groupBy({ by: ["staffId", "type"], _sum: { amountAED: true }, where: { createdAt: { gte: start, lt: end } } }),
    prisma.payAdjustment.groupBy({ by: ["staffId", "type"], _sum: { amountAED: true }, where: { month } }),
    prisma.payrollPayment.findMany({ where: { month } }),
  ]);

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
    const net = s.salaryAED + commission + a.bonus - a.deductions;
    const pay = paidMap.get(s.id);
    return {
      staffId: s.id, name: s.name, role: s.role, active: s.active,
      salary: s.salaryAED, salesCommission: c.sales, referral: c.referral, commission,
      bonus: a.bonus, deductions: a.deductions, net,
      paid: !!pay, paidAt: pay?.paidAt.toISOString() ?? null,
    };
  });

  const totals = rows.reduce(
    (t, r) => ({
      salary: t.salary + r.salary,
      commission: t.commission + r.commission,
      bonus: t.bonus + r.bonus,
      deductions: t.deductions + r.deductions,
      net: t.net + r.net,
      paidNet: t.paidNet + (r.paid ? r.net : 0),
      outstandingNet: t.outstandingNet + (r.paid ? 0 : r.net),
    }),
    { salary: 0, commission: 0, bonus: 0, deductions: 0, net: 0, paidNet: 0, outstandingNet: 0 }
  );

  return { month, rows, totals };
}
