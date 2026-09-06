import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { TableSearch } from "@/components/erp/TableSearch";
import { StaffEditRow } from "@/components/erp/StaffEditRow";
import { AddStaffForm } from "@/components/erp/AddStaffForm";
import { MonthPicker } from "@/components/erp/MonthPicker";
import { PayrollRun } from "@/components/erp/PayrollRun";
import { PreviousMonthAlert } from "@/components/erp/PreviousMonthAlert";
import { PayrollTable } from "@/components/erp/PayrollTable";
import { TeamPerformance } from "@/components/erp/TeamPerformance";
import { buildPerformance } from "@/lib/performance-core";
import { getPayrollMonth, recentMonths, dubaiMonthRange, currentDubaiMonth } from "@/lib/payroll";
import { getSalesBreakdown } from "@/lib/finance";
import type { PayrollRow } from "@/lib/payroll";

export const dynamic = "force-dynamic";

function labelOf(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Who is still waiting on this month's pay, and how much that is. */
function settlement(rows: PayrollRow[]) {
  const due = rows.filter((r) => !r.paid && r.net > 0); // a zero/negative net is never "waiting"
  return {
    dueCount: due.length,
    paidCount: rows.filter((r) => r.paid).length,
    outstandingAED: due.reduce((t, r) => t + r.net, 0),
  };
}

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
  // Month sales for the P&L summary — ex-VAT (the salon's actual revenue; VAT is held for the FTA,
  // and it matches the charged-price basis of Jacqueline's sheet). Gross Profit = sales − net payroll.
  const totalSales = (await getSalesBreakdown(dubaiMonthRange(payroll.month))).net;
  const performance = buildPerformance(payroll.rows);
  const monthLabel = labelOf(payroll.month);
  const months = recentMonths(12);

  const isCurrentMonth = payroll.month === currentDubaiMonth();
  const now = settlement(payroll.rows);

  // Last month is only worth flagging while you are standing in this one — that is exactly when an
  // unfinished payroll is invisible. Browsing history costs no extra query.
  const previousMonth = months[1];
  const prevPayroll = isCurrentMonth && previousMonth ? await getPayrollMonth(previousMonth) : null;
  const prev = prevPayroll ? settlement(prevPayroll.rows) : null;

  const activeCount = staff.filter((s) => s.active).length;

  return (
    <div className="space-y-6">
      {/* Command bar — what you are looking at, and which month it is about */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-cream">Staff &amp; Payroll</h1>
          <p className="mt-1 text-sm text-muted">
            {activeCount} active {activeCount === 1 ? "artist" : "artists"} · showing {monthLabel}
          </p>
        </div>
        <MonthPicker months={months} current={payroll.month} />
      </div>

      {/* Unfinished business first */}
      {prev && prev.dueCount > 0 && previousMonth && (
        <PreviousMonthAlert
          month={previousMonth}
          monthLabel={labelOf(previousMonth)}
          dueCount={prev.dueCount}
          outstandingAED={prev.outstandingAED}
        />
      )}

      {/* This month's payroll: the answer, then the one action that closes it */}
      <PayrollRun
        month={payroll.month}
        monthLabel={monthLabel}
        isCurrentMonth={isCurrentMonth}
        dueCount={now.dueCount}
        paidCount={now.paidCount}
        outstandingAED={now.outstandingAED}
        netAED={payroll.totals.net}
        totalSalesAED={totalSales}
      />

      {/* Who is performing — derived from the payroll rows, so no extra queries */}
      <TeamPerformance data={performance} monthLabel={monthLabel} />

      {/* Line-by-line payslips for the month */}
      <PayrollTable month={payroll.month} rows={payroll.rows} />

      {/* Reference: what each artist is on. Read first, edit on purpose. */}
      <section className="space-y-3 border-t border-ink-line pt-8">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl text-cream">
            <Users size={17} className="text-gold" /> Pay configuration
          </h2>
          <p className="mt-1 text-sm text-muted">
            Base salary and commission split per artist. These feed every payroll above.
          </p>
        </div>

        {/* Onboarding a new artist is pay configuration, so it lives here rather than at the top
            of the page where it outranked the month's actual payroll. */}
        <AddStaffForm />

        <TableSearch placeholder="Search staff by name, role or salary…">
          <div className="surface overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-ink-line text-left text-muted">
                <tr>
                  <th className="p-3 font-medium">Artist</th>
                  <th className="p-3 font-medium">Schedule</th>
                  <th className="p-3 text-right font-medium">Salary</th>
                  <th className="p-3 text-right font-medium">Commission</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 text-right font-medium">Edit</th>
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
                    joinedOn={s.joinedOn ? s.joinedOn.toISOString().slice(0, 10) : null}
                    active={s.active}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </TableSearch>
        <p className="text-xs text-muted">
          Salary 0 = commission-only. An artist is paid the <span className="text-sand">higher</span> of their
          salary or their commission — never both. Referral % is always added on top.
        </p>
      </section>
    </div>
  );
}
