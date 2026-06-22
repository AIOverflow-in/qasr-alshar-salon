import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/erp/inventory?barcode=XXX — lookup a product by barcode
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get("barcode");
  if (!barcode) return NextResponse.json({ error: "barcode required" }, { status: 400 });

  const product = await prisma.product.findFirst({
    where: { barcode, active: true },
    select: { id: true, name: true, category: true, qty: true, saleAED: true, barcode: true },
  });

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ product });
}

const adjustSchema = z.object({
  productId: z.string().min(1),
  kind: z.enum(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"]),
  qty: z.number().int().refine((n) => n !== 0, { message: "qty cannot be zero" }),
  note: z.string().max(300).optional().nullable(),
});

// POST /api/erp/inventory — adjust stock
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = adjustSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { productId, kind, qty, note } = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, qty: true, name: true } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const newQty = product.qty + qty;
  if (newQty < 0) return NextResponse.json({ error: "Stock cannot go below 0" }, { status: 409 });

  await prisma.$transaction([
    prisma.product.update({ where: { id: productId }, data: { qty: newQty } }),
    prisma.stockMovement.create({
      data: { productId, kind, qty, note: note ?? null, staffId: null },
    }),
  ]);

  return NextResponse.json({ ok: true, newQty, productName: product.name });
}
