import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  Users,
  Package,
  Scissors,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession, FINANCE_ROLES } from "@/lib/auth";
import { aed } from "@/lib/utils";
import { getMonthlyRevenue, dubaiDayRange } from "@/lib/finance";
import { getMonthlyAnalytics } from "@/lib/analytics";
import { MonthlyAnalytics } from "@/components/erp/MonthlyAnalytics";

const REVENUE_TARGET = 100_000;

export default async function ErpDashboard() {
  const session = await getSession();
  // Crown artists open straight into their calendar; reception into bookings — the dashboard is
  // owner/investor-only (per the meeting: block dashboards for the general team & reception).
  if (session?.role === "STYLIST") redirect("/erp/calendar");
  if (session?.role === "RECEPTION") redirect("/erp/bookings");
  const canSeeFinance = !!session && FINANCE_ROLES.includes(session.role);
  const { start: todayStart, end: todayEnd } = dubaiDayRange(0);
  const now = new Date();

  const [todayCount, upcoming, clients, products, staffCount, lowStock] =
    await Promise.all([
      prisma.booking.count({ where: { status: "CONFIRMED", startAt: { gte: todayStart, lt: todayEnd } } }),
      prisma.booking.count({ where: { status: "CONFIRMED", startAt: { gte: now } } }),
      prisma.client.count(),
      prisma.product.count({ where: { active: true } }),
      prisma.staff.count({ where: { active: true } }),
      prisma.product.findMany({ where: { active: true, qty: { lte: 3 } }, take: 8, orderBy: { qty: "asc" } }),
    ]);

  // Revenue/finance is only loaded + shown for finance roles (not RECEPTION/STYLIST).
  const revenue = canSeeFinance ? await getMonthlyRevenue() : null;
  const monthRevenue = revenue?.gross ?? 0;
  const pct = Math.min(100, Math.round((monthRevenue / REVENUE_TARGET) * 100));

  // Rich analytics charts are SUPER_ADMIN only (for now). One cached query feeds all six views.
  const isSuperAdmin = session?.role === "SUPER_ADMIN";
  const analytics = isSuperAdmin ? await getMonthlyAnalytics() : null;

  // Staff documents expiring within 30 days (or already expired) — managers only.
  const isManager = session?.role === "SUPER_ADMIN" || session?.role === "ADMIN";
  const DOC_LABEL: Record<string, string> = { PASSPORT: "Passport", VISA: "Visa", LABOR_CARD: "Labour card", EMIRATES_ID: "Emirates ID", OTHER: "Document" };
  const expiringDocs = isManager
    ? await prisma.staffDocument.findMany({
        where: { expiry: { lte: new Date(Date.now() + 30 * 864e5) } },
        orderBy: { expiry: "asc" }, take: 12,
        select: { id: true, type: true, expiry: true, staff: { select: { name: true } } },
      })
    : [];

  const stats = [
    { label: "Today's Bookings", value: todayCount, icon: CalendarDays, href: "/erp/bookings" },
    { label: "Upcoming", value: upcoming, icon: TrendingUp, href: "/erp/bookings" },
    { label: "Clients", value: clients, icon: Users, href: "/erp/clients" },
    { label: "Crown Artists", value: staffCount, icon: Scissors, href: "/erp/staff" },
    { label: "Products", value: products, icon: Package, href: "/erp/inventory" },
    { label: "Low Stock", value: lowStock.length, icon: AlertTriangle, href: "/erp/inventory" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-cream">Welcome back</h1>
        <p className="text-sm text-muted">Qasr Alshar control centre · {session?.email}</p>
      </div>

      {/* This-month money: super-admin gets the rich analytics hub; other finance roles keep the card. */}
      {isSuperAdmin && analytics ? (
        <MonthlyAnalytics data={analytics} />
      ) : canSeeFinance && revenue ? (
        <div className="surface rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-cream">This Month</h2>
            <span className="text-sm text-muted">Target {aed(REVENUE_TARGET)}</span>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <span className="font-display text-4xl text-gold-gradient">{aed(monthRevenue)}</span>
            <span className="pb-1 text-sm text-muted">{pct}% of monthly goal</span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-ink-card">
            <div className="h-full rounded-full bg-gold-gradient" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            {revenue.orders} paid {revenue.orders === 1 ? "invoice" : "invoices"} this month · {aed(revenue.net)} net + {aed(revenue.vat)} VAT. Every POS bill updates this in real time.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="surface surface-hover rounded-2xl p-5">
            <s.icon className="text-gold" size={22} />
            <div className="mt-3 font-display text-3xl text-cream">{s.value}</div>
            <div className="text-xs uppercase tracking-wider text-muted">{s.label}</div>
          </Link>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl text-cream">Low Stock</h2>
            <Link href="/erp/inventory" className="inline-flex items-center gap-1 text-sm text-gold hover:underline">
              Manage inventory <ArrowRight size={14} />
            </Link>
          </div>
          <div className="surface overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-ink-line/60">
                {lowStock.map((p) => (
                  <tr key={p.id}>
                    <td className="p-4 text-sand">{p.name}</td>
                    <td className="p-4 text-xs text-muted">{p.category}</td>
                    <td className="p-4 text-right">
                      <span className={`rounded-full border px-2.5 py-1 text-xs ${p.qty === 0 ? "border-red-500/40 text-red-400" : "border-gold/40 text-gold"}`}>
                        {p.qty} left
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isManager && expiringDocs.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl text-cream">Documents expiring soon</h2>
            <Link href="/erp/staff" className="inline-flex items-center gap-1 text-sm text-gold hover:underline">Staff <ArrowRight size={14} /></Link>
          </div>
          <div className="surface overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-ink-line/60">
                {expiringDocs.map((d) => {
                  const exp = d.expiry ? new Date(d.expiry) : null;
                  const expired = exp ? exp.getTime() < Date.now() : false;
                  return (
                    <tr key={d.id}>
                      <td className="p-4 text-sand">{d.staff?.name ?? "—"}</td>
                      <td className="p-4 text-xs text-muted">{DOC_LABEL[d.type] ?? d.type}</td>
                      <td className="p-4 text-right">
                        <span className={`rounded-full border px-2.5 py-1 text-xs ${expired ? "border-red-500/40 text-red-400" : "border-gold/40 text-gold"}`}>
                          {expired ? "expired" : "expires"} {exp ? exp.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
