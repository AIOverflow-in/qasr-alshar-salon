import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPayrollMonth } from "@/lib/payroll";
import { buildPayslipPdf } from "@/lib/payslip-pdf";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ staffId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { staffId } = await params;
  const month = new URL(req.url).searchParams.get("month") ?? undefined;

  const payroll = await getPayrollMonth(month);
  const row = payroll.rows.find((r) => r.staffId === staffId);
  if (!row) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const pdf = await buildPayslipPdf({
    staffName: row.name,
    role: row.role,
    month: payroll.month,
    salary: row.salary,
    salesCommission: row.salesCommission,
    referral: row.referral,
    bonus: row.bonus,
    deductions: row.deductions,
    net: row.net,
    paidAt: row.paidAt,
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="payslip-${row.name.replace(/\s+/g, "-")}-${payroll.month}.pdf"`,
    },
  });
}
