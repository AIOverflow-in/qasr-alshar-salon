import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TableSearch } from "@/components/erp/TableSearch";
import { StaffEditRow } from "@/components/erp/StaffEditRow";
import { PayrollTable } from "@/components/erp/PayrollTable";
import { getPayrollMonth, recentMonths } from "@/lib/payroll";

export const dynamic = "force-dynamic";

export default async function ErpStaff({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const ok = await requireRole(["SUPER_ADMIN", "ADMIN"]);
  if (!ok) redirect("/erp");

  const { month: monthParam } = await searchParams;

  const [staff, payroll] = await Promise.all([
    prisma.staff.findMany({ orderBy: { order: "asc" } }),
    getPayrollMonth(monthParam),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-cream">Staff &amp; Payroll</h1>
        <p className="text-sm text-muted">{staff.filter((s) => s.active).length} active · {staff.length} total — set pay config below, run monthly payroll underneath.</p>
      </div>

      {/* Pay configuration */}
      <div className="space-y-3">
        <h2 className="font-display text-xl text-cream">Pay configuration</h2>
        <TableSearch placeholder="Search staff by name or role…">
          <div className="surface overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-ink-line text-left text-muted">
                <tr>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Role</th>
                  <th className="p-3 font-medium">Hours</th>
                  <th className="p-3 font-medium">Off Day</th>
                  <th className="p-3 font-medium">Phone</th>
                  <th className="p-3 font-medium">Salary (AED/mo)</th>
                  <th className="p-3 font-medium">Commission</th>
                  <th className="p-3 font-medium">Status</th>
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
                    phone={s.phone}
                    salaryAED={s.salaryAED}
                    commissionPct={s.commissionPct}
                    referralPct={s.referralPct}
                    active={s.active}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </TableSearch>
        <p className="text-xs text-muted">Salary 0 = commission-only. Commission = sales split % · referral %. These feed the payroll below.</p>
      </div>

      {/* Monthly payroll */}
      <PayrollTable month={payroll.month} months={recentMonths(12)} rows={payroll.rows} totals={payroll.totals} />
    </div>
  );
}
