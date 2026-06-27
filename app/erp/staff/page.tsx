import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { aed } from "@/lib/utils";
import { TableSearch } from "@/components/erp/TableSearch";
import { StaffEditRow } from "@/components/erp/StaffEditRow";

export const dynamic = "force-dynamic";

function monthStartUTC() {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - 4 * 3600_000);
}

export default async function ErpStaff() {
  const ok = await requireRole(["SUPER_ADMIN", "ADMIN"]);
  if (!ok) redirect("/erp");

  const monthStart = monthStartUTC();

  const [staff, commissions] = await Promise.all([
    prisma.staff.findMany({ orderBy: { order: "asc" } }),
    prisma.commission.groupBy({
      by: ["staffId", "paid"],
      _sum: { amountAED: true },
      where: { createdAt: { gte: monthStart } },
    }),
  ]);

  const earnedMap = new Map<string, number>();
  const paidMap = new Map<string, number>();
  for (const c of commissions) {
    const amt = c._sum.amountAED ?? 0;
    earnedMap.set(c.staffId, (earnedMap.get(c.staffId) ?? 0) + amt);
    if (c.paid) paidMap.set(c.staffId, (paidMap.get(c.staffId) ?? 0) + amt);
  }
  const commMap = earnedMap;
  const totalEarned = [...earnedMap.values()].reduce((a, b) => a + b, 0);
  const totalPaid = [...paidMap.values()].reduce((a, b) => a + b, 0);
  const totalOutstanding = totalEarned - totalPaid;
  const staffWithComm = staff.filter((s) => (earnedMap.get(s.id) ?? 0) > 0);

  // per-stylist booking count this month
  const bookingCounts = await prisma.booking.groupBy({
    by: ["staffId"],
    _count: true,
    where: { startAt: { gte: monthStart }, status: { in: ["CONFIRMED", "COMPLETED"] }, staffId: { not: null } },
  });
  const bookMap = new Map(bookingCounts.map((b) => [b.staffId!, b._count]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-cream">Staff &amp; Payroll</h1>
          <p className="text-sm text-muted">{staff.filter((s) => s.active).length} active · {staff.length} total</p>
        </div>
        <a href="/api/erp/payroll/export" className="rounded-full border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10">Export payroll (CSV)</a>
      </div>

      <TableSearch placeholder="Search staff by name or role…">
      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b border-ink-line text-left text-muted">
            <tr>
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Role</th>
              <th className="p-4 font-medium">Hours</th>
              <th className="p-4 font-medium">Off Day</th>
              <th className="p-4 font-medium text-right">Bookings (MTD)</th>
              <th className="p-4 font-medium">Commission</th>
              <th className="p-4 font-medium text-right">Earned (MTD)</th>
              <th className="p-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line/60">
            {staff.map((s) => (
              <StaffEditRow
                key={s.id}
                id={s.id}
                name={s.name}
                role={s.role}
                hours={s.hours}
                offDay={s.offDay}
                commissionPct={s.commissionPct}
                referralPct={s.referralPct}
                active={s.active}
                bookingsMTD={bookMap.get(s.id) ?? 0}
                earnedMTD={commMap.get(s.id) ?? 0}
              />
            ))}
          </tbody>
        </table>
      </div>
      </TableSearch>

      {/* Commissions & payroll this month */}
      {staffWithComm.length > 0 && (
        <div className="surface rounded-2xl p-5">
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-ink-line p-4">
              <div className="font-display text-2xl text-gold-gradient">{aed(totalEarned)}</div>
              <div className="text-xs text-muted">Earned this month</div>
            </div>
            <div className="rounded-xl border border-ink-line p-4">
              <div className="font-display text-2xl text-green-400">{aed(totalPaid)}</div>
              <div className="text-xs text-muted">Paid</div>
            </div>
            <div className="rounded-xl border border-ink-line p-4">
              <div className="font-display text-2xl text-gold">{aed(totalOutstanding)}</div>
              <div className="text-xs text-muted">Outstanding</div>
            </div>
          </div>
          <h2 className="font-display text-lg text-cream mb-3">By Crown Artist</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {staffWithComm.map((s) => {
              const earned = earnedMap.get(s.id) ?? 0;
              const paid = paidMap.get(s.id) ?? 0;
              const outstanding = earned - paid;
              return (
                <div key={s.id} className="rounded-xl border border-ink-line p-4">
                  <div className="text-sm text-cream">{s.name}</div>
                  <div className="mt-1 font-display text-xl text-gold">{aed(earned)}</div>
                  <div className="mt-1 text-xs text-muted">{outstanding > 0 ? `${aed(outstanding)} outstanding` : "All settled ✓"}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">Auto-computed from POS sales (per-artist split + marketer referral). Use the row "settle" to mark a stylist paid, or export the CSV above.</p>
        </div>
      )}
    </div>
  );
}
