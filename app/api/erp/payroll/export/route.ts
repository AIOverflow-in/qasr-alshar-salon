import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPayrollMonth } from "@/lib/payroll";

export const dynamic = "force-dynamic";

function cell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Full monthly payroll CSV: salary + commission + bonus − advances/deductions = net, paid status.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const month = new URL(req.url).searchParams.get("month") ?? undefined;
  const payroll = await getPayrollMonth(month);

  const header = ["Staff", "Role", "Salary AED", "Sales commission AED", "Referral AED", "Bonus AED", "Advances/Deductions AED", "Net pay AED", "Status"];
  const rows = [header.join(",")];
  for (const r of payroll.rows) {
    if (r.net === 0 && !r.paid) continue; // skip staff with nothing this month
    rows.push([r.name, r.role, r.salary, r.salesCommission, r.referral, r.bonus, r.deductions, r.net, r.paid ? "Paid" : "Due"].map(cell).join(","));
  }
  const t = payroll.totals;
  rows.push(["TOTAL", "", t.salary, "", "", t.bonus, t.deductions, t.net, ""].map(cell).join(","));

  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="qasr-payroll-${payroll.month}.csv"`,
    },
  });
}
