import { prisma } from "@/lib/prisma";
import { PosTerminal, type PosPrefill } from "./PosTerminal";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "POS Checkout — Qasr Alshar ERP" };

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) redirect("/erp");

  const { bookingId } = await searchParams;

  const [services, staff, clients] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { category: "asc" }, select: { id: true, name: true, category: true, priceAED: true, durationMin: true } }),
    prisma.staff.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, take: 500, select: { id: true, name: true, phone: true } }),
  ]);

  // Build a prefill when arriving from a booking → "Generate Bill".
  let prefill: PosPrefill | undefined;
  if (bookingId) {
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
      <PosTerminal services={services} staff={staff} clients={clients} prefill={prefill} />
    </div>
  );
}
