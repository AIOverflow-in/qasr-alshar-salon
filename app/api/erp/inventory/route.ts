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

async function requireManager() {
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) return null;
  return session;
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(120).default("Retail / Aftercare"),
  barcode: z.string().max(64).optional().nullable(),
  qty: z.number().int().nonnegative().default(0),
  costAED: z.number().int().nonnegative().optional().nullable(),
  saleAED: z.number().int().nonnegative().optional().nullable(),
  reorderAt: z.number().int().nonnegative().default(3),
  retail: z.boolean().optional(),
});

// PUT /api/erp/inventory — create a new product
export async function PUT(req: Request) {
  if (!(await requireManager())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  const product = await prisma.product.create({
    data: {
      name: d.name.trim(),
      category: d.category.trim() || "Retail / Aftercare",
      barcode: d.barcode?.trim() || null,
      qty: d.qty,
      costAED: d.costAED ?? null,
      saleAED: d.saleAED ?? null,
      reorderAt: d.reorderAt,
      retail: d.retail ?? false,
    },
  });
  // Record the opening stock as a movement for the audit trail.
  if (d.qty > 0) {
    await prisma.stockMovement.create({ data: { productId: product.id, kind: "STOCK_IN", qty: d.qty, note: "Opening stock" } });
  }
  return NextResponse.json({ ok: true, product });
}

const editSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  category: z.string().max(120).optional(),
  barcode: z.string().max(64).optional().nullable(),
  costAED: z.number().int().nonnegative().optional().nullable(),
  saleAED: z.number().int().nonnegative().optional().nullable(),
  reorderAt: z.number().int().nonnegative().optional(),
  retail: z.boolean().optional(),
  active: z.boolean().optional(),
});

// PATCH /api/erp/inventory — update product fields (not qty; use POST for stock)
export async function PATCH(req: Request) {
  if (!(await requireManager())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { id, ...data } = parsed.data;
  if (data.name) data.name = data.name.trim();
  if (data.barcode !== undefined) data.barcode = data.barcode?.trim() || null;
  const product = await prisma.product.update({ where: { id }, data });
  return NextResponse.json({ ok: true, product });
}
