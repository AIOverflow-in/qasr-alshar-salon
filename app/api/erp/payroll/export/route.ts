import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPayrollMonth } from "@/lib/payroll";
import { csvCell as cell, csvFile } from "@/lib/csv-core";

export const dynamic = "force-dynamic";

// Full monthly payroll CSV: salary + commission + bonus − advances/deductions = net, paid status.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const month = new URL(req.url).searchParams.get("month") ?? undefined;
  const payroll = await getPayrollMonth(month);

  // "Commission %" and the ex-VAT label are here because their absence made this sheet unreadable:
  // an artist on 0% showed a growing Services figure beside a frozen commission and looked like a
  // broken calculation. Commission is 40% of the ex-VAT value, not of the VAT-inclusive price the
  // client paid, so the ratio in this sheet is ~38% of gross and needs saying out loud.
  const header = ["Staff", "Role", "Services AED (ex-VAT)", "Salary AED", "Commission %", "Sales commission AED", "Referral AED", "Bonus AED", "Advances/Deductions AED", "Net pay AED", "Basis", "Status"];
  const rows = [header.join(",")];
  for (const r of payroll.rows) {
    if (r.net === 0 && !r.paid) continue; // skip staff with nothing this month
    // Which side of max(commission, salary) actually paid them — otherwise a salaried artist looks
    // underpaid on commission when the floor is simply higher.
    const basis = r.salesCommission > r.salary ? "Commission" : "Salary floor";
    rows.push([r.name, r.role, r.servicesAED, r.salary, r.commissionPct, r.salesCommission, r.referral, r.bonus, r.deductions, r.net, basis, r.paid ? "Paid" : "Due"].map(cell).join(","));
  }
  const t = payroll.totals;
  rows.push(["TOTAL", "", t.services, t.salary, "", t.salesCommission, t.referral, t.bonus, t.deductions, t.net, "", ""].map(cell).join(","));

  return new Response(csvFile(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="qasr-payroll-${payroll.month}.csv"`,
    },
  });
}
