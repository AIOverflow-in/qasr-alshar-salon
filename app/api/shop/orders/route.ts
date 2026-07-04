import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { orderTotal, type ShopProduct } from "@/lib/shop-core";
import { sendShopOrderEmails } from "@/lib/email";

export const dynamic = "force-dynamic";

const schema = z.object({
  items: z.array(z.object({ productId: z.string().min(1), qty: z.number().int().min(1).max(99) })).min(1).max(50),
  customerName: z.string().min(2).max(120),
  phone: z.string().min(6).max(30),
  email: z.string().email().max(160).optional().nullable(),
  address: z.string().min(6).max(600),
  emirate: z.string().max(60).optional().nullable(),
  notes: z.string().max(600).optional().nullable(),
  clientRequestId: z.string().min(8).max(80).optional().nullable(),
});

const ref = (id: string) => "QA-SH-" + id.slice(-6).toUpperCase();

// Public cash-on-delivery checkout. No auth (customers order without an account). Stock is decremented
// atomically inside a Serializable transaction so a burst of orders can never oversell.
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please check your details and try again." }, { status: 400 });
  const d = parsed.data;

  // Idempotency: a double-submitted checkout returns the first order instead of a duplicate.
  if (d.clientRequestId) {
    const existing = await prisma.shopOrder.findUnique({ where: { clientRequestId: d.clientRequestId }, select: { id: true, totalAED: true, itemCount: true } });
    if (existing) return NextResponse.json({ ok: true, order: { id: existing.id, ref: ref(existing.id), totalAED: existing.totalAED, itemCount: existing.itemCount }, idempotent: true });
  }

  let order: { id: string; totalAED: number; itemCount: number };
  try {
    order = await prisma.$transaction(async (tx) => {
      const ids = [...new Set(d.items.map((i) => i.productId))];
      const products = (await tx.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, saleAED: true, qty: true, retail: true, active: true, imageUrl: true },
      })) as ShopProduct[];
      const byId = new Map(products.map((p) => [p.id, p]));
      const { items, itemCount, totalAED } = orderTotal(d.items, (id) => byId.get(id));
      if (!items.length || totalAED <= 0) throw new Error("EMPTY");

      for (const li of items) {
        const res = await tx.product.updateMany({ where: { id: li.productId, qty: { gte: li.qty } }, data: { qty: { decrement: li.qty } } });
        if (res.count === 0) throw new Error("OUT_OF_STOCK");
        await tx.stockMovement.create({ data: { productId: li.productId, kind: "STOCK_OUT", qty: -li.qty, note: "Shop order (COD)" } });
      }

      return tx.shopOrder.create({
        data: {
          clientRequestId: d.clientRequestId || null,
          customerName: d.customerName.trim(), phone: d.phone.trim(), email: d.email?.trim().toLowerCase() || null,
          address: d.address.trim(), emirate: d.emirate?.trim() || null, notes: d.notes?.trim() || null,
          items, itemCount, totalAED, status: "PENDING", paymentMethod: "COD",
        },
        select: { id: true, totalAED: true, itemCount: true },
      });
    }, { isolationLevel: "Serializable" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "EMPTY") return NextResponse.json({ error: "Your cart is empty or those items are no longer available." }, { status: 400 });
    if (msg === "OUT_OF_STOCK") return NextResponse.json({ error: "Sorry — one of those items just went out of stock. Please review your cart.", code: "OUT_OF_STOCK" }, { status: 409 });
    // Idempotency race: two concurrent submits with the same clientRequestId — the loser hits the
    // unique constraint (P2002); return the order the winner created instead of a 500.
    if (d.clientRequestId && (e as { code?: string })?.code === "P2002") {
      const existing = await prisma.shopOrder.findUnique({ where: { clientRequestId: d.clientRequestId }, select: { id: true, totalAED: true, itemCount: true } });
      if (existing) return NextResponse.json({ ok: true, order: { id: existing.id, ref: ref(existing.id), totalAED: existing.totalAED, itemCount: existing.itemCount }, idempotent: true });
    }
    if (msg.includes("40001") || msg.includes("could not serialize")) return NextResponse.json({ error: "Please try again.", code: "RETRY" }, { status: 409 });
    console.error("[shop/orders] create failed:", e);
    return NextResponse.json({ error: "Could not place your order. Please try again." }, { status: 500 });
  }

  const orderRef = ref(order.id);
  try {
    await sendShopOrderEmails({
      ref: orderRef, customerName: d.customerName.trim(), email: d.email?.trim().toLowerCase() || null,
      phone: d.phone.trim(), address: d.address.trim(), emirate: d.emirate?.trim() || null, totalAED: order.totalAED, itemCount: order.itemCount,
    });
  } catch (e) { console.error("[shop/orders] email failed (order saved):", e); }

  return NextResponse.json({ ok: true, order: { id: order.id, ref: orderRef, totalAED: order.totalAED, itemCount: order.itemCount } });
}
