// Pure, dependency-free aggregation for the dashboard's monthly analytics.
// No prisma / no "server-only" here on purpose — this is unit-tested directly (lib/analytics-core.test.ts).

export type OrderRow = {
  totalAED: number;
  subtotalAED: number;
  vatAED: number;
  createdAt: Date;
  paymentMethod: string;
  splitPayment: boolean;
  cashAED: number;
  cardAED: number;
  transferAED: number;
  lines: { kind: string; description: string; lineAED: number }[];
};

export type MonthlyAnalytics = {
  monthLabel: string;
  target: number;
  total: number; // gross takings incl. VAT
  net: number;
  vat: number;
  count: number;
  daysInMonth: number;
  todayDom: number; // day-of-month today (Dubai)
  firstWeekday: number; // 0=Mon … 6=Sun, weekday of the 1st (calendar layout)
  byDay: { day: number; amount: number }[]; // 1..daysInMonth
  byWeekday: { label: string; amount: number }[]; // Mon..Sun
  byMethod: { CASH: number; CARD: number; TRANSFER: number };
  byCategory: { name: string; amount: number }[]; // desc
  hottestDay: { day: number; amount: number };
  daysTraded: number;
  avgActiveDay: number;
  strongestWeekday: { label: string; amount: number };
  topCategory: { name: string; amount: number };
};

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Dubai calendar date (YYYY-MM-DD) of an instant. */
export const dubaiParts = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** Mon-based weekday index (0=Mon … 6=Sun) for a Dubai date string. */
export const monIndex = (dateISO: string) => (new Date(`${dateISO}T12:00:00+04:00`).getUTCDay() + 6) % 7;

/**
 * Fold this month's PAID orders into all six chart datasets. Pure function of its inputs:
 * `orders` (already filtered to the month), `catByName` (service name → category), and the
 * month context (`monthKey` = "YYYY-MM", `now` for today's day-of-month).
 */
export function aggregateMonthly(
  orders: OrderRow[],
  catByName: Map<string, string>,
  opts: { monthKey: string; now: Date },
): MonthlyAnalytics {
  const [y, m] = opts.monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstWeekday = monIndex(`${opts.monthKey}-01`);
  const todayDom = Number(dubaiParts(opts.now).split("-")[2]);
  const monthLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));

  const byDay = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, amount: 0 }));
  const byWeekday = WEEKDAYS.map((label) => ({ label, amount: 0 }));
  const byMethod = { CASH: 0, CARD: 0, TRANSFER: 0 };
  const catMap = new Map<string, number>();
  let total = 0, net = 0, vat = 0;

  for (const o of orders) {
    total += o.totalAED; net += o.subtotalAED; vat += o.vatAED;
    const iso = dubaiParts(o.createdAt);
    const dom = Number(iso.split("-")[2]);
    if (dom >= 1 && dom <= daysInMonth) byDay[dom - 1].amount += o.totalAED;
    byWeekday[monIndex(iso)].amount += o.totalAED;

    if (o.splitPayment) { byMethod.CASH += o.cashAED; byMethod.CARD += o.cardAED; byMethod.TRANSFER += o.transferAED; }
    else if (o.paymentMethod in byMethod) byMethod[o.paymentMethod as keyof typeof byMethod] += o.totalAED;

    for (const l of o.lines) {
      const cat = l.kind === "PRODUCT" ? "Retail" : (catByName.get(l.description) ?? "Other");
      catMap.set(cat, (catMap.get(cat) ?? 0) + l.lineAED);
    }
  }

  const byCategory = [...catMap.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const hottestDay = byDay.reduce((best, d) => (d.amount > best.amount ? d : best), { day: 0, amount: 0 });
  const daysTraded = byDay.filter((d) => d.amount > 0).length;
  const strongestWeekday = byWeekday.reduce((best, d) => (d.amount > best.amount ? d : best), { label: "—", amount: 0 });
  const topCategory = byCategory[0] ?? { name: "—", amount: 0 };

  return {
    monthLabel, target: 100_000, total, net, vat, count: orders.length,
    daysInMonth, todayDom, firstWeekday, byDay, byWeekday, byMethod, byCategory,
    hottestDay, daysTraded, avgActiveDay: daysTraded ? Math.round(total / daysTraded) : 0,
    strongestWeekday, topCategory,
  };
}
