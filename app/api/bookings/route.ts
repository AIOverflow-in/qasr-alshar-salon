import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSlotBookable } from "@/lib/availability";
import { sendBookingEmails } from "@/lib/email";

export const dynamic = "force-dynamic";

const schema = z.object({
  serviceId: z.string().min(1),
  startISO: z.string().datetime(),
  customerName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(6).max(30),
  notes: z.string().max(800).optional().nullable(),
  staffId: z.string().optional().nullable(),
  locale: z.enum(["en", "ar"]).optional(),
});

function dubaiLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check your details and try again." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const service = await prisma.service.findUnique({
    where: { id: data.serviceId },
  });
  if (!service || !service.active) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  // Pre-validate against the slot grid (working hours, lead time, blocks, alignment).
  const check = await isSlotBookable(data.startISO, service.durationMin);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 409 });
  }

  const start = new Date(data.startISO);
  const end = new Date(start.getTime() + service.durationMin * 60_000);

  // Create inside a serializable transaction that re-checks capacity, so two
  // simultaneous requests can never oversell the same slot (double-booking guard).
  let booking;
  try {
    booking = await prisma.$transaction(
      async (tx) => {
        const settings = await tx.salonSettings.findUnique({
          where: { id: "singleton" },
        });
        const capacity = settings?.capacity ?? 3;
        const overlapping = await tx.booking.count({
          where: {
            status: "CONFIRMED",
            startAt: { lt: end },
            endAt: { gt: start },
          },
        });
        if (overlapping >= capacity) throw new Error("CAPACITY_FULL");

        return tx.booking.create({
          data: {
            serviceId: service.id,
            serviceName: service.name,
            priceAED: service.priceAED,
            durationMin: service.durationMin,
            customerName: data.customerName.trim(),
            email: data.email.trim().toLowerCase(),
            phone: data.phone.trim(),
            notes: data.notes?.trim() || null,
            startAt: start,
            endAt: end,
            status: "CONFIRMED",
            locale: data.locale ?? "en",
            staffId: data.staffId || null,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "CAPACITY_FULL" || msg.includes("40001") || msg.includes("could not serialize")) {
      return NextResponse.json(
        { error: "That time was just taken. Please pick another slot." },
        { status: 409 }
      );
    }
    console.error("[bookings] create failed:", e);
    return NextResponse.json({ error: "Could not complete booking. Please try again." }, { status: 500 });
  }

  // Fire emails but never let a mail failure break the committed booking.
  try {
    await sendBookingEmails({
      customerName: booking.customerName,
      email: booking.email,
      phone: booking.phone,
      serviceName: booking.serviceName,
      priceAED: booking.priceAED,
      whenLabel: dubaiLabel(start),
      notes: booking.notes,
    });
  } catch (e) {
    console.error("[bookings] email send failed (booking still saved):", e);
  }

  return NextResponse.json({
    ok: true,
    booking: {
      id: booking.id,
      serviceName: booking.serviceName,
      whenLabel: dubaiLabel(start),
      priceAED: booking.priceAED,
    },
  });
}
