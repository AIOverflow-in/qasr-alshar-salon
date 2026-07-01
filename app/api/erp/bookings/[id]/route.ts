import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const lineSchema = z.object({
  serviceId: z.string().min(1),
  priceAED: z.number().int().nonnegative().optional().nullable(),
});

const schema = z.object({
  // Per-line agreed prices (services[]) or a plain id list (serviceIds[], price = menu rate).
  services: z.array(lineSchema).min(1).max(12).optional(),
  serviceIds: z.array(z.string().min(1)).min(1).max(12).optional(),
  // Optionally reschedule (Dubai-time ISO). Omit to keep the current time.
  startISO: z.string().datetime().optional(),
  // Optionally set/clear the marketer (lead source). Omit to leave unchanged.
  marketerId: z.string().nullable().optional(),
}).refine((d) => (d.services && d.services.length) || (d.serviceIds && d.serviceIds.length), { message: "Pick at least one service." });

/**
 * Edit a booking's services, agreed prices and/or time.
 * Staff-driven, so it intentionally does NOT enforce closing hours or capacity —
 * reception is in control. Only blocked once the booking is billed.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Pick at least one service." }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { salesOrders: { where: { status: "PAID" }, select: { id: true } } },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.salesOrders.length) return NextResponse.json({ error: "This booking is already billed — edit the invoice instead." }, { status: 409 });
  if (booking.status === "CANCELLED") return NextResponse.json({ error: "This booking is cancelled. Re-confirm it first to edit." }, { status: 409 });

  // Resolve the new service set (preserve chosen order). Accept per-line agreed prices
  // (services[]) or a plain id list (serviceIds[], price defaults to the menu rate).
  const requested = parsed.data.services?.length
    ? parsed.data.services
    : parsed.data.serviceIds!.map((serviceId) => ({ serviceId, priceAED: null as number | null }));
  const ids = requested.map((r) => r.serviceId);
  const found = await prisma.service.findMany({ where: { id: { in: ids } } });
  const lines = requested
    .map((r) => {
      const svc = found.find((s) => s.id === r.serviceId);
      return svc ? { svc, price: r.priceAED != null ? r.priceAED : svc.priceAED } : null;
    })
    .filter((x): x is { svc: (typeof found)[number]; price: number } => x !== null);
  if (!lines.length) return NextResponse.json({ error: "Service not found." }, { status: 404 });

  const totalDuration = lines.reduce((s, l) => s + l.svc.durationMin, 0);
  const totalPrice = lines.reduce((s, l) => s + l.price, 0);
  const summaryName = lines.length === 1 ? lines[0].svc.name : `${lines[0].svc.name} +${lines.length - 1} more`;
  const start = parsed.data.startISO ? new Date(parsed.data.startISO) : booking.startAt;
  const end = new Date(start.getTime() + totalDuration * 60_000);
  const staffId = booking.staffId;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.bookingItem.deleteMany({ where: { bookingId: id } });
      await tx.booking.update({
        where: { id },
        data: {
          serviceId: lines[0].svc.id,
          serviceName: summaryName,
          priceAED: totalPrice,
          durationMin: totalDuration,
          startAt: start,
          endAt: end,
          ...(parsed.data.marketerId !== undefined ? { marketerId: parsed.data.marketerId || null } : {}),
          items: { create: lines.map((l) => ({ serviceId: l.svc.id, serviceName: l.svc.name, priceAED: l.price, durationMin: l.svc.durationMin, staffId: staffId || null })) },
        },
      });
    });
  } catch (e) {
    console.error("[erp/bookings/edit] failed:", e);
    return NextResponse.json({ error: "Could not update the booking. Please try again." }, { status: 500 });
  }

  revalidatePath("/erp/bookings");
  revalidatePath("/erp");
  return NextResponse.json({ ok: true, serviceName: summaryName, priceAED: totalPrice });
}
