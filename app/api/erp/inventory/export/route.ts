import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const products = await prisma.product.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  const header = ["name", "category", "barcode", "qty", "costAED", "saleAED", "reorderAt"];
  const lines = [header.join(",")];
  for (const p of products) {
    lines.push([p.name, p.category, p.barcode ?? "", p.qty, p.costAED ?? "", p.saleAED ?? "", p.reorderAt].map(csvCell).join(","));
  }
  const csv = lines.join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="qasr-inventory.csv"`,
    },
  });
}
