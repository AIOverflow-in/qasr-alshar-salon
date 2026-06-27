import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { dubaiWeekday, dubaiInstant } from "@/lib/availability";

export const dynamic = "force-dynamic";

const schema = z.object({
  serviceIds: z.array(z.string().min(1)).min(1).max(12),
});

/**
 * Edit the services on a booking BEFORE it starts.
 * Recomputes duration/price/end, re-validates the (longer) slot against the
 * stylist/salon capacity excluding this booking itself, and replaces its items.
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
  if (booking.status !== "CONFIRMED") return NextResponse.json({ error: "Only upcoming (confirmed) bookings can be edited." }, { status: 409 });
  if (booking.salesOrders.length) return NextResponse.json({ error: "This booking is already billed — edit the invoice instead." }, { status: 409 });
  if (booking.startAt.getTime() <= Date.now()) return NextResponse.json({ error: "This booking has already started and can't be edited." }, { status: 409 });

  // Resolve the new service set (preserve chosen order).
  const found = await prisma.service.findMany({ where: { id: { in: parsed.data.serviceIds }, active: true } });
  const services = parsed.data.serviceIds.map((sid) => found.find((s) => s.id === sid)).filter(Boolean) as typeof found;
  if (!services.length) return NextResponse.json({ error: "Service not found." }, { status: 404 });

  const totalDuration = services.reduce((s, x) => s + x.durationMin, 0);
  const totalPrice = services.reduce((s, x) => s + x.priceAED, 0);
  const summaryName = services.length === 1 ? services[0].name : `${services[0].name} +${services.length - 1} more`;
  const start = booking.startAt;
  const end = new Date(start.getTime() + totalDuration * 60_000);

  // Don't let the new (longer) duration run past closing for that Dubai day.
  const dateISO = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(start);
  const hours = await prisma.workingHours.findUnique({ where: { weekday: dubaiWeekday(dateISO) } });
  if (hours && !hours.closed) {
    const close = dubaiInstant(dateISO, hours.close);
    if (end > close) return NextResponse.json({ error: "These services run past closing time. Remove one or move the booking." }, { status: 409 });
  }

  const staffId = booking.staffId;
  try {
    await prisma.$transaction(async (tx) => {
      const settings = await tx.salonSettings.findUnique({ where: { id: "singleton" } });
      const capacity = staffId ? 1 : settings?.capacity ?? 3;
      // Overlap excluding THIS booking (its current slot doesn't count against itself).
      const overlapping = await tx.booking.count({
        where: { id: { not: id }, status: "CONFIRMED", startAt: { lt: end }, endAt: { gt: start }, ...(staffId ? { staffId } : {}) },
      });
      if (overlapping >= capacity) throw new Error("CAPACITY_FULL");

      await tx.bookingItem.deleteMany({ where: { bookingId: id } });
      await tx.booking.update({
        where: { id },
        data: {
          serviceId: services[0].id,
          serviceName: summaryName,
          priceAED: totalPrice,
          durationMin: totalDuration,
          endAt: end,
          items: { create: services.map((s) => ({ serviceId: s.id, serviceName: s.name, priceAED: s.priceAED, durationMin: s.durationMin, staffId: staffId || null })) },
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "CAPACITY_FULL" || msg.includes("40001") || msg.includes("could not serialize")) {
      return NextResponse.json({ error: staffId ? "That artist isn't free for the longer time. Shorten the services or reassign." : "Not enough capacity for the longer time. Please adjust." }, { status: 409 });
    }
    console.error("[erp/bookings/edit] failed:", e);
    return NextResponse.json({ error: "Could not update the booking. Please try again." }, { status: 500 });
  }

  revalidatePath("/erp/bookings");
  revalidatePath("/erp");
  return NextResponse.json({ ok: true, serviceName: summaryName, priceAED: totalPrice });
}
