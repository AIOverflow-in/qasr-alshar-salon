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
    prisma.staff.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, take: 2000, select: { id: true, name: true, phone: true } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, take: 2000, select: { id: true, name: true, category: true, saleAED: true, qty: true } }),
  ]);

  // Build a prefill when arriving from a booking → "Generate Bill".
  let prefill: PosPrefill | undefined;

  // Editing an existing invoice → prefill from the order.
  if (orderId) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { lines: true, client: { select: { id: true, name: true, phone: true, email: true } } },
    });
    if (order) {
      prefill = {
        orderId: order.id,
        invoiceNo: order.invoiceNo,
        paymentMethod: order.paymentMethod as "CASH" | "CARD" | "TRANSFER",
        staffId: order.staffId ?? undefined,
        marketerId: order.marketerId ?? undefined,
        lines: order.lines.map((l) => ({ description: l.description, qty: l.qty, unitAED: l.unitAED, kind: l.kind as "SERVICE" | "PRODUCT", productId: l.productId, staffId: l.staffId })),
        client: order.client ? { id: order.client.id, name: order.client.name, phone: order.client.phone, email: order.client.email } : undefined,
      };
    }
  } else if (bookingId) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (booking) {
      // Try to match an existing client by phone (fall back to email).
      const matched = booking.phone
        ? await prisma.client.findFirst({ where: { phone: booking.phone }, select: { id: true, name: true, phone: true, email: true } })
        : null;
      const whenLabel = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
      }).format(booking.startAt);
      prefill = {
        bookingId: booking.id,
        bookingLabel: `${booking.customerName} · ${whenLabel}`,
        lines: [{ description: booking.serviceName, qty: 1, unitAED: booking.priceAED, kind: "SERVICE" }],
        staffId: booking.staffId ?? undefined,
        client: matched
          ? { id: matched.id, name: matched.name, phone: matched.phone, email: matched.email }
          : { name: booking.customerName, phone: booking.phone, email: booking.email },
      };
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-cream">POS Checkout</h1>
      <PosTerminal services={services} staff={staff} clients={clients} products={products} prefill={prefill} />
    </div>
  );
}
