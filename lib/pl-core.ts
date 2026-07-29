/**
 * Pure Profit & Loss assembly + period resolution — no DB/env, so it's unit-tested and reused by
 * the finance P&L page, the PDF, and the CSV export. The VAT-registered flag is passed in (from
 * lib/tax.ts) so this stays pure.
 *
 * Income basis: a business books as income the money it actually keeps. Until the salon is
 * VAT-registered it keeps the whole amount customers pay, so income = gross. Once VAT-registered,
 * the 5% VAT is a liability held for the FTA, so income is shown net of VAT and the VAT is excluded.
 */
import { netFromInclusive, vatFromInclusive } from "./vat-core";
import { dubaiRangeForDate, type DayRange } from "./finance-core";

/** Friendly labels for the expense categories (schema enum → P&L line). */
export const EXPENSE_LABELS: Record<string, string> = {
  RENT: "Rent",
  UTILITIES: "Utilities",
  SALARIES: "Salaries & wages",
  VISA: "Visas & permits",
  SUPPLIES: "Supplies & stock",
  MARKETING: "Marketing & advertising",
  MAINTENANCE: "Repairs & maintenance",
  OTHER: "Other operating expenses",
};

/** The salon's first Corporate-Tax period, from the CT registration certificate. */
export const CT_PERIOD = { from: "2025-12-01", to: "2026-12-31", label: "Tax period · 1 Dec 2025 – 31 Dec 2026" } as const;

export type PLInput = {
  vatRegistered: boolean;
  vatPct?: number;
  serviceGrossAED: number; // gross service takings (incl. VAT) for the window
  productGrossAED: number; // gross retail takings (incl. VAT) for the window
  expensesByCategory: { category: string; amountAED: number }[];
};

export type PLLine = { label: string; amountAED: number };

export type PLReport = {
  incomeBasis: "gross" | "net";
  income: PLLine[];
  totalIncome: number;
  vatCollected: number; // 0 unless VAT-registered
  expenses: PLLine[]; // labelled, zero rows dropped, largest first
  totalExpenses: number;
  netProfit: number;
  netMarginPct: number; // netProfit / totalIncome, one decimal
  basisNote: string;
};

export function buildProfitAndLoss(input: PLInput): PLReport {
  const pct = input.vatPct ?? 5;
  const reg = input.vatRegistered;
  const totalGross = input.serviceGrossAED + input.productGrossAED;

  const svc = reg ? netFromInclusive(input.serviceGrossAED, pct) : input.serviceGrossAED;
  const prod = reg ? netFromInclusive(input.productGrossAED, pct) : input.productGrossAED;
  const vatCollected = reg ? vatFromInclusive(totalGross, pct) : 0;

  const income: PLLine[] = [];
  if (svc) income.push({ label: "Service revenue", amountAED: svc });
  if (prod) income.push({ label: "Retail / product revenue", amountAED: prod });
  const totalIncome = svc + prod;

  const expenses = input.expensesByCategory
    .map((e) => ({ label: EXPENSE_LABELS[e.category] ?? e.category, amountAED: e.amountAED }))
    .filter((e) => e.amountAED !== 0)
    .sort((a, b) => b.amountAED - a.amountAED);
  const totalExpenses = expenses.reduce((s, e) => s + e.amountAED, 0);

  const netProfit = totalIncome - totalExpenses;
  const netMarginPct = totalIncome ? Math.round((netProfit / totalIncome) * 1000) / 10 : 0;

  const basisNote = reg
    ? `Income is shown net of ${pct}% VAT. VAT collected (AED ${vatCollected.toLocaleString("en-US")}) is held for the FTA and is not income.`
    : "The salon is not yet VAT-registered, so income is the full amount received from clients.";

  return { incomeBasis: reg ? "net" : "gross", income, totalIncome, vatCollected, expenses, totalExpenses, netProfit, netMarginPct, basisNote };
}

// ── Period resolution ─────────────────────────────────────────────────────────

export type PLPeriod = { start: Date; end: Date; label: string; period: string; from: string; to: string };

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const pretty = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Dubai calendar "today" as YYYY-MM-DD (Dubai is UTC+4, no DST). */
export function dubaiTodayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Build a range that spans whole Dubai days from `fromISO` to `toISO` inclusive. */
function spanFor(fromISO: string, toISO: string, label: string, period: string): PLPeriod {
  const a = dubaiRangeForDate(fromISO);
  const b = dubaiRangeForDate(toISO);
  const [lo, hi] = a.start <= b.start ? [a, b] : [b, a];
  const [f, t] = a.start <= b.start ? [fromISO, toISO] : [toISO, fromISO];
  return { start: lo.start, end: hi.end, label, period, from: f, to: t };
}

/**
 * Resolve the P&L window from URL params.
 * Precedence: named ?period= (month | lastmonth | year | ct) → custom ?from=&to= → this month.
 */
export function resolvePLRange(params: { period?: string; from?: string; to?: string }, now = new Date()): PLPeriod {
  const today = dubaiTodayISO(now);
  const [y, m] = today.split("-").map(Number);
  const first = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}-01`;
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate(); // mm is 1-based → day 0 of next month

  switch (params.period) {
    case "lastmonth": {
      const ly = m === 1 ? y - 1 : y;
      const lm = m === 1 ? 12 : m - 1;
      return spanFor(first(ly, lm), `${first(ly, lm).slice(0, 7)}-${String(lastDay(ly, lm)).padStart(2, "0")}`,
        new Date(Date.UTC(ly, lm - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }), "lastmonth");
    }
    case "year":
      return spanFor(first(y, 1), today, `Year to date · ${y}`, "year");
    case "ct":
      return spanFor(CT_PERIOD.from, CT_PERIOD.to, CT_PERIOD.label, "ct");
    case "custom":
      if (isDate(params.from) && isDate(params.to))
        return spanFor(params.from!, params.to!, `${pretty(params.from!)} – ${pretty(params.to!)}`, "custom");
    // falls through to this-month when custom dates are missing/invalid
    // eslint-disable-next-line no-fallthrough
    default:
      return spanFor(first(y, m), today,
        new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }), "month");
  }
}

// ── CSV export ─────────────────────────────────────────────────────────────────

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** A spreadsheet-friendly P&L: two sections (Income, Expenses) + totals + net profit. */
export function buildPLCsv(r: PLReport, period: { label: string; from: string; to: string }): string {
  const rows: (string | number)[][] = [
    ["Qasr Alshar Salon — Profit & Loss"],
    ["Period", period.label],
    ["From", period.from],
    ["To", period.to],
    [],
    ["Section", "Line", "Amount (AED)"],
  ];
  for (const l of r.income) rows.push(["Income", l.label, l.amountAED]);
  rows.push(["Income", "Total income", r.totalIncome]);
  if (r.vatCollected) rows.push(["Note", "VAT collected (held for FTA, not income)", r.vatCollected]);
  rows.push([]);
  for (const l of r.expenses) rows.push(["Expenses", l.label, l.amountAED]);
  rows.push(["Expenses", "Total expenses", r.totalExpenses]);
  rows.push([]);
  rows.push(["Result", "Net profit", r.netProfit]);
  rows.push(["Result", "Net margin (%)", r.netMarginPct]);
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export type { DayRange };
