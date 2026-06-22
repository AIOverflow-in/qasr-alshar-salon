import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { aed } from "@/lib/utils";

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
      by: ["staffId"],
      _sum: { amountAED: true },
      where: { createdAt: { gte: monthStart } },
    }),
  ]);

  const commMap = new Map(commissions.map((c) => [c.staffId, c._sum.amountAED ?? 0]));

  // per-stylist booking count this month
  const bookingCounts = await prisma.booking.groupBy({
    by: ["staffId"],
    _count: true,
    where: { startAt: { gte: monthStart }, status: { in: ["CONFIRMED", "COMPLETED"] }, staffId: { not: null } },
  });
  const bookMap = new Map(bookingCounts.map((b) => [b.staffId!, b._count]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Staff</h1>
        <p className="text-sm text-muted">{staff.filter((s) => s.active).length} active · {staff.length} total</p>
      </div>

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
              <tr key={s.id}>
                <td className="p-4 font-medium text-cream">{s.name}</td>
                <td className="p-4 text-sand">{s.role}</td>
                <td className="p-4 text-muted text-xs">{s.hours}</td>
                <td className="p-4 text-muted">{s.offDay ?? "—"}</td>
                <td className="p-4 text-right text-sand">{bookMap.get(s.id) ?? 0}</td>
                <td className="p-4 text-xs text-muted">{s.commissionPct}% split · {s.referralPct}% ref</td>
                <td className="p-4 text-right font-semibold text-gold">{commMap.get(s.id) ? aed(commMap.get(s.id)!) : "—"}</td>
                <td className="p-4">
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${s.active ? "border-green-500/40 text-green-400" : "border-muted/40 text-muted"}`}>
                    {s.active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Commissions this month */}
      {commissions.length > 0 && (
        <div className="surface rounded-2xl p-5">
          <h2 className="font-display text-lg text-cream mb-3">Commissions This Month</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {commissions.map((c) => {
              const staffMember = staff.find((s) => s.id === c.staffId);
              if (!staffMember) return null;
              return (
                <div key={c.staffId} className="rounded-xl border border-ink-line p-4">
                  <div className="text-sm text-cream">{staffMember.name}</div>
                  <div className="mt-1 font-display text-xl text-gold">{aed(c._sum.amountAED ?? 0)}</div>
                  <div className="text-xs text-muted">{staffMember.commissionPct}% of sales</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">Commissions are auto-computed from POS sales. Payroll export coming next.</p>
        </div>
      )}
    </div>
  );
}
