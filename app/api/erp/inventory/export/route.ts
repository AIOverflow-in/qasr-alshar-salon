import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { csvCell, csvFile } from "@/lib/csv-core";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const products = await prisma.product.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  // These lowercase headers are a CONTRACT, not a style choice: this file is edited and
  // re-uploaded through /api/erp/inventory/import, which matches columns by these exact names.
  // Renaming them to Title Case would silently break the stock-take round-trip.
  const header = ["name", "category", "barcode", "qty", "costAED", "saleAED", "reorderAt"];
  const lines = [header.join(",")];
  for (const p of products) {
    lines.push([p.name, p.category, p.barcode ?? "", p.qty, p.costAED ?? "", p.saleAED ?? "", p.reorderAt].map(csvCell).join(","));
  }
  const csv = csvFile(lines);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="qasr-inventory.csv"`,
    },
  });
}
