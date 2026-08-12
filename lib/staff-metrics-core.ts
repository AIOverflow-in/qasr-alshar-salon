/**
 * Pure per-artist performance metrics. No DB/env, so it's unit-tested and the page just feeds it
 * rows it has already fetched.
 *
 * Everything is derived from the artist's SERVICE lines: a shared service is split equally between
 * the artists on it, exactly as the commission engine does, so these numbers reconcile with pay.
 */

export type MetricLine = {
  lineAED: number;      // gross (VAT-inclusive) value of the line
  artistCount: number;  // how many artists shared this line
  createdAt: Date;
  clientKey: string;    // clientId, or a per-order key for walk-ins
  description: string;  // service name
};

export type MonthPoint = { month: string; label: string; revenueAED: number; clients: number };
export type ServiceCount = { name: string; times: number; revenueAED: number };

export type StaffMetrics = {
  revenueAED: number;
  clients: number;        // distinct clients served
  repeatClients: number;  // clients seen more than once in the window
  repeatRatePct: number;
  avgPerClientAED: number;
  avgPerVisitAED: number;
  visits: number;         // service lines performed
  trend: MonthPoint[];
  topServices: ServiceCount[];
  busiestDay: string | null;
};

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const monthKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit" }).format(d).slice(0, 7);
const monthName = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
};

/** `months` is the window to chart, oldest→newest, so quiet months still show as a gap. */
export function buildStaffMetrics(lines: MetricLine[], months: string[]): StaffMetrics {
  const share = (l: MetricLine) => l.lineAED / Math.max(1, l.artistCount);

  const revenueAED = Math.round(lines.reduce((s, l) => s + share(l), 0));
  const visits = lines.length;

  const perClient = new Map<string, number>();
  for (const l of lines) perClient.set(l.clientKey, (perClient.get(l.clientKey) ?? 0) + 1);
  const clients = perClient.size;
  const repeatClients = [...perClient.values()].filter((n) => n > 1).length;

  const byMonth = new Map<string, { rev: number; clients: Set<string> }>();
  for (const l of lines) {
    const k = monthKey(l.createdAt);
    const e = byMonth.get(k) ?? { rev: 0, clients: new Set<string>() };
    e.rev += share(l);
    e.clients.add(l.clientKey);
    byMonth.set(k, e);
  }
  const trend: MonthPoint[] = months.map((m) => ({
    month: m,
    label: monthName(m),
    revenueAED: Math.round(byMonth.get(m)?.rev ?? 0),
    clients: byMonth.get(m)?.clients.size ?? 0,
  }));

  const svc = new Map<string, ServiceCount>();
  for (const l of lines) {
    const e = svc.get(l.description) ?? { name: l.description, times: 0, revenueAED: 0 };
    e.times += 1;
    e.revenueAED += share(l);
    svc.set(l.description, e);
  }
  const topServices = [...svc.values()]
    .map((s) => ({ ...s, revenueAED: Math.round(s.revenueAED) }))
    .sort((a, b) => b.revenueAED - a.revenueAED || b.times - a.times)
    .slice(0, 5);

  const dayCount = new Array(7).fill(0);
  for (const l of lines) {
    const d = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dubai", weekday: "short" }).format(l.createdAt);
    const i = DAY.findIndex((x) => x.startsWith(d));
    if (i >= 0) dayCount[i] += 1;
  }
  const best = dayCount.indexOf(Math.max(...dayCount));

  return {
    revenueAED,
    clients,
    repeatClients,
    repeatRatePct: clients ? Math.round((repeatClients / clients) * 1000) / 10 : 0,
    avgPerClientAED: clients ? Math.round(revenueAED / clients) : 0,
    avgPerVisitAED: visits ? Math.round(revenueAED / visits) : 0,
    visits,
    trend,
    topServices,
    busiestDay: visits > 0 && dayCount[best] > 0 ? DAY[best] : null,
  };
}
