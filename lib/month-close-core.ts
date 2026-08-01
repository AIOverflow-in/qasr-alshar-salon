/**
 * Pure assembly for the dashboard "Month close" overview — one month-scoped picture of the money:
 * sales (+ weekly and monthly-trend trajectory), salaries, other expenses, and the net.
 * No DB/env, so it's unit-tested and reused by the server loader (lib/month-close.ts).
 */
import { EXPENSE_LABELS } from "./pl-core";

export type MoneyOrder = { createdAt: Date; totalAED: number; subtotalAED?: number; vatAED?: number };

export type WeekBar = { label: string; grossAED: number };
export type MonthBar = { month: string; label: string; grossAED: number };
export type ExpenseSlice = { label: string; amountAED: number; kind: "salaries" | "expense" };

export type MonthClose = {
  month: string;           // "YYYY-MM"
  label: string;           // "August 2026"
  isCurrent: boolean;
  sales: { grossAED: number; netAED: number; vatAED: number; orders: number };
  salaries: { netAED: number; paidAED: number; outstandingAED: number; owedCount: number; paidCount: number };
  otherExpensesAED: number;
  expenseSlices: ExpenseSlice[]; // salaries + expense categories, largest first (for "where it went")
  netProfitAED: number;          // net sales − salaries − other expenses
  weekly: WeekBar[];
  trend: MonthBar[];
};

const pad = (n: number) => String(n).padStart(2, "0");

/** "August 2026" from "YYYY-MM". */
export function monthLabel(monthISO: string): string {
  const [y, m] = monthISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
/** Short "Aug '26" for compact trend labels. */
export function monthShort(monthISO: string): string {
  const [y, m] = monthISO.split("-").map(Number);
  return `${new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })} '${pad(y % 100)}`;
}

/** The `n` months ending at (and including) `monthISO`, oldest→newest. Deterministic (no clock). */
export function monthsEndingAt(monthISO: string, n: number): string[] {
  const [y, m] = monthISO.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  return out;
}

/** Dubai-local "YYYY-MM-DD" for a UTC instant (Dubai = UTC+4, no DST). */
function dubaiYMD(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export type BuildInput = {
  month: string;
  isCurrent: boolean;
  monthOrders: MoneyOrder[];
  trendOrders: MoneyOrder[];
  trendMonths: string[]; // oldest→newest, includes `month`
  payroll: { net: number; paidNet: number; outstandingNet: number };
  owedCount: number;
  paidCount: number;
  expenseGroups: { category: string; amountAED: number }[];
};

export function buildMonthClose(i: BuildInput): MonthClose {
  const [y, mm] = i.month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, mm, 0)).getUTCDate();
  const weekCount = Math.ceil(daysInMonth / 7);

  // Sales totals for the month.
  let grossAED = 0, netAED = 0, vatAED = 0;
  const weekGross = new Array(weekCount).fill(0);
  for (const o of i.monthOrders) {
    grossAED += o.totalAED;
    netAED += o.subtotalAED ?? 0;
    vatAED += o.vatAED ?? 0;
    const day = Number(dubaiYMD(o.createdAt).slice(8, 10));
    const w = Math.min(weekCount - 1, Math.floor((day - 1) / 7));
    weekGross[w] += o.totalAED;
  }
  const weekly: WeekBar[] = weekGross.map((g, idx) => ({ label: `Wk ${idx + 1}`, grossAED: g }));

  // Monthly trend (gross sales) across the trend window.
  const byMonth = new Map<string, number>();
  for (const o of i.trendOrders) {
    const key = dubaiYMD(o.createdAt).slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + o.totalAED);
  }
  const trend: MonthBar[] = i.trendMonths.map((m) => ({ month: m, label: monthShort(m), grossAED: byMonth.get(m) ?? 0 }));

  // Expenses: salaries come from payroll; "other" excludes any SALARIES expense rows (avoid double count).
  const otherExpensesAED = i.expenseGroups
    .filter((e) => e.category !== "SALARIES")
    .reduce((s, e) => s + e.amountAED, 0);

  const expenseSlices: ExpenseSlice[] = [
    { label: "Salaries & commissions", amountAED: i.payroll.net, kind: "salaries" as const },
    ...i.expenseGroups
      .filter((e) => e.category !== "SALARIES" && e.amountAED !== 0)
      .map((e) => ({ label: EXPENSE_LABELS[e.category] ?? e.category, amountAED: e.amountAED, kind: "expense" as const })),
  ]
    .filter((s) => s.amountAED > 0)
    .sort((a, b) => b.amountAED - a.amountAED);

  const netProfitAED = netAED - i.payroll.net - otherExpensesAED;

  return {
    month: i.month,
    label: monthLabel(i.month),
    isCurrent: i.isCurrent,
    sales: { grossAED, netAED, vatAED, orders: i.monthOrders.length },
    salaries: {
      netAED: i.payroll.net, paidAED: i.payroll.paidNet, outstandingAED: i.payroll.outstandingNet,
      owedCount: i.owedCount, paidCount: i.paidCount,
    },
    otherExpensesAED,
    expenseSlices,
    netProfitAED,
    weekly,
    trend,
  };
}
