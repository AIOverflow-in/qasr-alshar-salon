import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { monthStartUTC } from "@/lib/finance";

export const dynamic = "force-dynamic";

function cell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Payroll CSV for the current Dubai month: per staff, commission split / referral / paid / outstanding.
export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = monthStartUTC();
  const [staff, commissions] = await Promise.all([
    prisma.staff.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, role: true } }),
    prisma.commission.findMany({ where: { createdAt: { gte: since } }, select: { staffId: true, type: true, amountAED: true, paid: true } }),
  ]);

  type Agg = { split: number; referral: number; paid: number; total: number };
  const map = new Map<string, Agg>();
  for (const c of commissions) {
    const a = map.get(c.staffId) ?? { split: 0, referral: 0, paid: 0, total: 0 };
    if (c.type === "REFERRAL") a.referral += c.amountAED; else a.split += c.amountAED;
    a.total += c.amountAED;
    if (c.paid) a.paid += c.amountAED;
    map.set(c.staffId, a);
  }

  const header = ["Staff", "Role", "Sales commission AED", "Referral commission AED", "Total earned AED", "Paid AED", "Outstanding AED"];
  const rows = [header.join(",")];
  for (const s of staff) {
    const a = map.get(s.id);
    if (!a) continue;
    rows.push([s.name, s.role, a.split, a.referral, a.total, a.paid, a.total - a.paid].map(cell).join(","));
  }

  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="qasr-payroll-${new Date().toISOString().slice(0, 7)}.csv"`,
    },
  });
}
