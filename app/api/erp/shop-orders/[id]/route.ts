import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUSES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
const schema = z.object({ status: z.enum(STATUSES) });
type OrderItem = { productId: string; name: string; priceAED: number; qty: number; lineAED: number };
// CANCELLED + DELIVERED are terminal — no further changes (prevents re-open re-deduct + double actions).
const TERMINAL = new Set(["CANCELLED", "DELIVERED"]);

/**
 * Update a shop order's status (reception/admin). Concurrency-safe: the status change is a conditional
 * updateMany (only from the exact current status), so two racing requests can't both act — and stock is
 * restored exactly once when an un-shipped order is cancelled. Terminal states can't be changed.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["SUPER_ADMIN", "ADMIN", "RECEPTION"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const next = parsed.data.status;

  const order = await prisma.shopOrder.findUnique({ where: { id }, select: { status: true, items: true } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status === next) return NextResponse.json({ ok: true, status: next });
  if (TERMINAL.has(order.status)) return NextResponse.json({ error: `This order is ${order.status.toLowerCase()} and can no longer change.`, code: "TERMINAL" }, { status: 409 });

  const items = (Array.isArray(order.items) ? order.items : []) as unknown as OrderItem[];

  try {
    const changed = await prisma.$transaction(async (tx) => {
      // Atomic guard: only the request that still sees the current status wins → restock runs once.
      const res = await tx.shopOrder.updateMany({ where: { id, status: order.status }, data: { status: next } });
      if (res.count === 0) return false; // someone else already moved it
      if (next === "CANCELLED") {
        for (const it of items) {
          await tx.product.updateMany({ where: { id: it.productId }, data: { qty: { increment: it.qty } } });
          await tx.stockMovement.create({ data: { productId: it.productId, kind: "STOCK_IN", qty: it.qty, note: "Shop order cancelled" } });
        }
      }
      return true;
    }, { isolationLevel: "Serializable" });

    if (!changed) return NextResponse.json({ error: "That order was just updated elsewhere. Please refresh.", code: "CONFLICT" }, { status: 409 });
    revalidatePath("/erp/orders");
    return NextResponse.json({ ok: true, status: next });
  } catch (e) {
    console.error("[shop-orders] status update failed:", e);
    return NextResponse.json({ error: "Could not update the order." }, { status: 500 });
  }
}
