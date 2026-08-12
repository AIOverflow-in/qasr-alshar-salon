import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { slugify } from "@/lib/shop-core";
import { revalidateShopEverywhere } from "@/lib/revalidate-shop";

/**
 * Product images are stored EITHER as a full URL (Vercel Blob) or as a site-relative path such as
 * "/products/cb-sunlit-muse.jpg". Requiring z.string().url() rejected the relative form, so editing
 * any of the ~84 products with a local image failed with "Invalid input" and neither the price nor
 * the description could be saved. Accept both; reject anything that isn't one of the two.
 */
const imageUrlField = z
  .string()
  .max(1000)
  .refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//.test(v), {
    message: "Must be a URL or a site path starting with /",
  })
  .optional()
  .nullable();

export const dynamic = "force-dynamic";

/** A storefront slug that's unique across products (appends -2, -3… on collision). */
async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const clash = await prisma.product.findFirst({ where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
    if (!clash) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// GET /api/erp/inventory?barcode=XXX — lookup a product by barcode
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get("barcode");
  if (!barcode || barcode.length > 64) return NextResponse.json({ error: "Invalid barcode" }, { status: 400 });

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

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Atomic: for a decrement, only succeed if enough stock remains (no race, no negative).
      const res = await tx.product.updateMany({
        where: qty < 0 ? { id: productId, qty: { gte: -qty } } : { id: productId },
        data: { qty: { increment: qty } },
      });
      if (res.count === 0) {
        const exists = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
        throw new Error(exists ? "NEGATIVE" : "NOT_FOUND");
      }
      await tx.stockMovement.create({ data: { productId, kind, qty, note: note ?? null, staffId: null } });
      const p = await tx.product.findUnique({ where: { id: productId }, select: { qty: true, name: true } });
      return p!;
    }, { isolationLevel: "Serializable" });
    await revalidateShopEverywhere(); // stock changes what the storefront shows as in/out of stock
    return NextResponse.json({ ok: true, newQty: updated.qty, productName: updated.name });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (e instanceof Error && e.message === "NEGATIVE") return NextResponse.json({ error: "Stock cannot go below 0" }, { status: 409 });
    console.error("[inventory] adjust failed:", e);
    return NextResponse.json({ error: "Could not adjust stock." }, { status: 500 });
  }
}

// Reception runs the front desk and already adjusts stock here, so they may add
// and edit products too. This matches the Inventory page's own access
// (["SUPER_ADMIN","ADMIN","RECEPTION"]) so the buttons no longer hit a dead end.
const INVENTORY_ROLES = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
async function requireInventoryAccess() {
  const session = await getSession();
  if (!session || !INVENTORY_ROLES.includes(session.role)) return null;
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
  description: z.string().max(2000).optional().nullable(),
  imageUrl: imageUrlField,
});

// PUT /api/erp/inventory — create a new product
export async function PUT(req: Request) {
  if (!(await requireInventoryAccess())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  try {
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
        description: d.description?.trim() || null,
        imageUrl: d.imageUrl || null,
        slug: await uniqueSlug(d.name),
      },
    });
    // Record the opening stock as a movement for the audit trail.
    if (d.qty > 0) {
      await prisma.stockMovement.create({ data: { productId: product.id, kind: "STOCK_IN", qty: d.qty, note: "Opening stock" } });
    }
    return NextResponse.json({ ok: true, product });
  } catch (e) {
    console.error("[inventory] create failed:", e);
    return NextResponse.json({ error: "Could not save the product." }, { status: 500 });
  }
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
  description: z.string().max(2000).optional().nullable(),
  imageUrl: imageUrlField,
});

// PATCH /api/erp/inventory — update product fields (not qty; use POST for stock)
export async function PATCH(req: Request) {
  if (!(await requireInventoryAccess())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { id, ...data } = parsed.data;
  if (data.name) data.name = data.name.trim();
  if (data.barcode !== undefined) data.barcode = data.barcode?.trim() || null;
  if (data.description !== undefined) data.description = data.description?.trim() || null;
  try {
    // Backfill a stable storefront slug if the product doesn't have one yet (never changes an existing slug).
    const current = await prisma.product.findUnique({ where: { id }, select: { slug: true, name: true } });
    if (!current) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const slug = !current.slug ? await uniqueSlug(data.name || current.name, id) : undefined;
    const product = await prisma.product.update({ where: { id }, data: { ...data, ...(slug ? { slug } : {}) } });
    await revalidateShopEverywhere(); // ERP and shop are separate Vercel projects — purge both
    return NextResponse.json({ ok: true, product });
  } catch (e) {
    console.error("[inventory] update failed:", e);
    return NextResponse.json({ error: "Could not save the product." }, { status: 500 });
  }
}
