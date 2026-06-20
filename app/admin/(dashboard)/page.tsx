import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock, Newspaper, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { aed } from "@/lib/utils";

function dubaiDayRange(offsetDays = 0) {
  const todayISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = todayISO.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d + offsetDays) - 4 * 3600_000);
  const end = new Date(start.getTime() + 24 * 3600_000);
  return { start, end };
}

function timeLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export default async function AdminOverview() {
  const { start: todayStart, end: todayEnd } = dubaiDayRange(0);
  const now = new Date();

  const [todayCount, upcomingCount, totalBookings, publishedPosts, todays] =
    await Promise.all([
      prisma.booking.count({
        where: { status: "CONFIRMED", startAt: { gte: todayStart, lt: todayEnd } },
      }),
      prisma.booking.count({ where: { status: "CONFIRMED", startAt: { gte: now } } }),
      prisma.booking.count(),
      prisma.blogPost.count({ where: { status: "PUBLISHED" } }),
      prisma.booking.findMany({
        where: { startAt: { gte: todayStart, lt: todayEnd } },
        orderBy: { startAt: "asc" },
      }),
    ]);

  const stats = [
    { label: "Today's Bookings", value: todayCount, icon: CalendarDays },
    { label: "Upcoming", value: upcomingCount, icon: Clock },
    { label: "Total Bookings", value: totalBookings, icon: CheckCircle2 },
    { label: "Published Posts", value: publishedPosts, icon: Newspaper },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-cream">Overview</h1>
          <p className="text-sm text-muted">Welcome back to Qasr Alshar.</p>
        </div>
        <Link
          href="/admin/bookings"
          className="hidden items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10 sm:inline-flex"
        >
          All bookings <ArrowRight size={15} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="surface rounded-2xl p-5">
            <s.icon className="text-gold" size={22} />
            <div className="mt-3 font-display text-3xl text-cream">{s.value}</div>
            <div className="text-xs uppercase tracking-wider text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-4 font-display text-xl text-cream">Today's Schedule</h2>
        {todays.length === 0 ? (
          <div className="surface rounded-2xl p-8 text-center text-muted">
            No bookings for today yet.
          </div>
        ) : (
          <div className="surface overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-line text-left text-muted">
                <tr>
                  <th className="p-4 font-medium">Time</th>
                  <th className="p-4 font-medium">Client</th>
                  <th className="p-4 font-medium">Service</th>
                  <th className="p-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line/60">
                {todays.map((b) => (
                  <tr key={b.id}>
                    <td className="p-4 text-gold">{timeLabel(b.startAt)}</td>
                    <td className="p-4">
                      <div className="text-cream">{b.customerName}</div>
                      <div className="text-xs text-muted">{b.phone}</div>
                    </td>
                    <td className="p-4 text-sand">
                      {b.serviceName}
                      <span className="ml-2 text-xs text-muted">{aed(b.priceAED)}</span>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    CONFIRMED: "border-gold/40 text-gold",
    COMPLETED: "border-green-500/40 text-green-400",
    CANCELLED: "border-red-500/40 text-red-400",
    NO_SHOW: "border-muted/40 text-muted",
  };
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}
