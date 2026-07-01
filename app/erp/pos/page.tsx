import { prisma } from "@/lib/prisma";
import { PosTerminal, type PosPrefill } from "./PosTerminal";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "POS Checkout — Qasr Alshar ERP" };

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string; orderId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) redirect("/erp");

  const { bookingId, orderId } = await searchParams;

  const [services, staff, clients, products] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { category: "asc" }, select: { id: true, name: true, category: true, priceAED: true, durationMin: true } }),
    prisma.staff.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true, commissionPct: true } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, take: 2000, select: { id: true, name: true, phone: true } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, take: 2000, select: { id: true, name: true, category: true, saleAED: true, qty: true } }),
  ]);

  // For a fresh walk-in bill, offer to attach a relevant booking (recent + upcoming, unbilled).
  let attachableBookings: { id: string; customerName: string; phone: string | null; serviceName: string; whenLabel: string }[] = [];
  if (!orderId && !bookingId) {
    const since = new Date(Date.now() - 7 * 24 * 3600_000); // last week through the future
    const list = await prisma.booking.findMany({
      where: { status: "CONFIRMED", startAt: { gte: since }, salesOrders: { none: { status: "PAID" } } },
      orderBy: { startAt: "desc" },
      take: 100,
      select: { id: true, customerName: true, phone: true, serviceName: true, startAt: true },
    });
    const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(d);
    attachableBookings = list.map((b) => ({ id: b.id, customerName: b.customerName, phone: b.phone, serviceName: b.serviceName, whenLabel: fmt(b.startAt) }));
  }

  // Build a prefill when arriving from a booking → "Generate Bill".
  let prefill: PosPrefill | undefined;

  // Editing an existing invoice → prefill from the order.
  if (orderId) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { lines: true, client: { select: { id: true, name: true, phone: true, email: true } } },
    });
    if (order) {
      // Existing commissions, so an edit preserves any agreed overrides (artists + marketer).
      const comms = await prisma.commission.findMany({ where: { orderId: order.id }, select: { staffId: true, amountAED: true, type: true } });
      const referral = comms.find((c) => c.type === "REFERRAL");
      prefill = {
        orderId: order.id,
        invoiceNo: order.invoiceNo,
        commissions: comms.filter((c) => c.type === "SALES_SPLIT").map((c) => ({ staffId: c.staffId, amountAED: c.amountAED })),
        marketerCommission: referral?.amountAED,
        paymentMethod: order.paymentMethod as "CASH" | "CARD" | "TRANSFER",
        splitPayment: order.splitPayment,
        cashAED: order.splitPayment ? order.cashAED : undefined,
        cardAED: order.splitPayment ? order.cardAED : undefined,
        transferAED: order.splitPayment ? order.transferAED : undefined,
        staffId: order.staffId ?? undefined,
        marketerId: order.marketerId ?? undefined,
        lines: order.lines.map((l) => ({ description: l.description, qty: l.qty, unitAED: l.unitAED, kind: l.kind as "SERVICE" | "PRODUCT", productId: l.productId, staffId: l.staffId, staffIds: l.staffIds })),
        client: order.client ? { id: order.client.id, name: order.client.name, phone: order.client.phone, email: order.client.email } : undefined,
      };
    }
  } else if (bookingId) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
    if (booking) {
      // Try to match an existing client by phone (fall back to email).
      const matched = booking.phone
        ? await prisma.client.findFirst({ where: { phone: booking.phone }, select: { id: true, name: true, phone: true, email: true } })
        : null;
      const whenLabel = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
      }).format(booking.startAt);
      // One POS line per booked service (multi-service bookings), carrying each line's artist.
      const lines = booking.items.length
        ? booking.items.map((it) => ({
            description: it.serviceName,
            qty: 1,
            unitAED: it.priceAED,
            kind: "SERVICE" as const,
            staffId: it.staffId ?? booking.staffId ?? null,
          }))
        : [{ description: booking.serviceName, qty: 1, unitAED: booking.priceAED, kind: "SERVICE" as const, staffId: booking.staffId ?? null }];
      prefill = {
        bookingId: booking.id,
        bookingLabel: `${booking.customerName} · ${whenLabel}`,
        lines,
        staffId: booking.staffId ?? undefined,
        marketerId: booking.marketerId ?? undefined, // carry the lead's marketer into the bill
        client: matched
          ? { id: matched.id, name: matched.name, phone: matched.phone, email: matched.email }
          : { name: booking.customerName, phone: booking.phone, email: booking.email },
      };
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-cream">POS Checkout</h1>
      <PosTerminal services={services} staff={staff} clients={clients} products={products} prefill={prefill} attachableBookings={attachableBookings} />
    </div>
  );
}
