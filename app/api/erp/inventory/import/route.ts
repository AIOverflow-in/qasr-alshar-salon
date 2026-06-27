import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const rowSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(120).optional().nullable(),
  barcode: z.string().max(64).optional().nullable(),
  qty: z.number().int().optional().nullable(),
  costAED: z.number().int().optional().nullable(),
  saleAED: z.number().int().optional().nullable(),
  reorderAt: z.number().int().optional().nullable(),
});
const schema = z.object({ rows: z.array(rowSchema).min(1).max(5000) });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Cap the payload so a huge upload can't exhaust memory on the function.
  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > 5 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 5 MB)." }, { status: 413 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid rows" }, { status: 400 });

  // Match existing by barcode first, then by name (case-insensitive).
  const existing = await prisma.product.findMany({ select: { id: true, barcode: true, name: true } });
  const byBarcode = new Map(existing.filter((p) => p.barcode).map((p) => [p.barcode!.trim(), p.id]));
  const byName = new Map(existing.map((p) => [p.name.trim().toLowerCase(), p.id]));

  let created = 0, updated = 0;
  const toCreate: { name: string; category: string; barcode: string | null; qty: number; costAED: number | null; saleAED: number | null; reorderAt: number }[] = [];

  for (const r of parsed.data.rows) {
    const name = r.name.trim();
    const barcode = r.barcode?.trim() || null;
    const id = (barcode && byBarcode.get(barcode)) || byName.get(name.toLowerCase());
    const fields = {
      name,
      category: r.category?.trim() || "Retail / Aftercare",
      barcode,
      ...(r.qty != null ? { qty: Math.max(0, r.qty) } : {}),
      ...(r.costAED != null ? { costAED: r.costAED } : {}),
      ...(r.saleAED != null ? { saleAED: r.saleAED } : {}),
      ...(r.reorderAt != null ? { reorderAt: r.reorderAt } : {}),
    };
    if (id) {
      await prisma.product.update({ where: { id }, data: fields });
      updated++;
    } else {
      toCreate.push({
        name, category: fields.category, barcode,
        qty: r.qty != null ? Math.max(0, r.qty) : 0,
        costAED: r.costAED ?? null, saleAED: r.saleAED ?? null,
        reorderAt: r.reorderAt ?? 3,
      });
      created++;
    }
  }
  if (toCreate.length) await prisma.product.createMany({ data: toCreate });

  revalidatePath("/erp/inventory");
  revalidatePath("/erp");
  return NextResponse.json({ ok: true, created, updated });
}
