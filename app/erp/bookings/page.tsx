import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { aed } from "@/lib/utils";

export const dynamic = "force-dynamic";

function whenLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d);
}

export default async function ErpBookings() {
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    prisma.booking.findMany({ where: { startAt: { gte: now } }, orderBy: { startAt: "asc" }, take: 100, include: { staff: true } }),
    prisma.booking.findMany({ where: { startAt: { lt: now } }, orderBy: { startAt: "desc" }, take: 30, include: { staff: true } }),
  ]);

  const Row = (b: (typeof upcoming)[number]) => (
    <tr key={b.id}>
      <td className="p-3 text-gold">{whenLabel(b.startAt)}</td>
      <td className="p-3"><div className="text-cream">{b.customerName}</div><div className="text-xs text-muted">{b.phone}</div></td>
      <td className="p-3 text-sand">{b.serviceName}</td>
      <td className="p-3 text-muted">{b.staff?.name ?? "—"}</td>
      <td className="p-3 text-cream">{aed(b.priceAED)}</td>
      <td className="p-3"><span className="rounded-full border border-ink-line px-2.5 py-1 text-xs text-sand">{b.status}</span></td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-cream">Bookings</h1>
        <Link href="/admin/bookings" className="rounded-full border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10">
          Manage statuses →
        </Link>
      </div>

      <div>
        <h2 className="mb-3 font-display text-xl text-cream">Upcoming ({upcoming.length})</h2>
        <div className="surface overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-ink-line text-left text-muted">
              <tr><th className="p-3 font-medium">When</th><th className="p-3 font-medium">Client</th><th className="p-3 font-medium">Service</th><th className="p-3 font-medium">Stylist</th><th className="p-3 font-medium">Price</th><th className="p-3 font-medium">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-line/60">
              {upcoming.length ? upcoming.map(Row) : <tr><td colSpan={6} className="p-8 text-center text-muted">No upcoming bookings.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {past.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-xl text-cream">Recent</h2>
          <div className="surface overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[680px] text-sm">
              <tbody className="divide-y divide-ink-line/60">{past.map(Row)}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
