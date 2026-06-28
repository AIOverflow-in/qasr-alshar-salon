import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSlotBookable } from "@/lib/availability";
import { sendBookingEmails } from "@/lib/email";
import { resolveClientId, hasActiveBooking } from "@/lib/clients";

export const dynamic = "force-dynamic";

const schema = z.object({
  // Accept a list of services (multi-service booking) or a single legacy serviceId.
  serviceIds: z.array(z.string().min(1)).min(1).max(12).optional(),
  serviceId: z.string().min(1).optional(),
  startISO: z.string().datetime(),
  customerName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(6).max(30),
  notes: z.string().max(800).optional().nullable(),
  staffId: z.string().optional().nullable(),
  locale: z.enum(["en", "ar"]).optional(),
  serviceMode: z.enum(["SALON", "HOME"]).optional(),
  address: z.string().max(400).optional().nullable(),
  customRequest: z.string().max(800).optional().nullable(),
}).refine((d) => (d.serviceIds && d.serviceIds.length) || d.serviceId, { message: "Pick at least one service." });

function dubaiLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d);
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please check your details and try again." }, { status: 400 });
  const data = parsed.data;

  // Resolve services (preserve the chosen order).
  const ids = data.serviceIds?.length ? data.serviceIds : [data.serviceId!];
  const found = await prisma.service.findMany({ where: { id: { in: ids }, active: true } });
  const services = ids.map((id) => found.find((s) => s.id === id)).filter(Boolean) as typeof found;
  if (!services.length) return NextResponse.json({ error: "Service not found." }, { status: 404 });

  const totalDuration = services.reduce((s, x) => s + x.durationMin, 0);
  const totalPrice = services.reduce((s, x) => s + x.priceAED, 0);
  const summaryName = services.length === 1 ? services[0].name : `${services[0].name} +${services.length - 1} more`;

  // Per-stylist (or salon-wide) slot validation against the combined duration.
  const check = await isSlotBookable(data.startISO, totalDuration, data.staffId || undefined);
  if (!check.ok) return NextResponse.json({ error: check.reason, code: "SLOT_TAKEN" }, { status: 409 });

  const phoneClean = data.phone.trim();
  const emailClean = data.email.trim().toLowerCase();

  // Block a second booking while the customer still has an active (upcoming) one.
  if (await hasActiveBooking({ phone: phoneClean, email: emailClean })) {
    return NextResponse.json(
      { error: "You already have an upcoming booking with us. Please complete or cancel it before booking again — or message us on WhatsApp to adjust it.", code: "ACTIVE_BOOKING" },
      { status: 409 }
    );
  }

  let clientId: string | null = null;
  try { clientId = await resolveClientId({ name: data.customerName, phone: phoneClean, email: emailClean }); }
  catch (e) { console.error("[bookings] client link failed (booking continues):", e); }

  const start = new Date(data.startISO);
  const end = new Date(start.getTime() + totalDuration * 60_000);

  let booking;
  try {
    booking = await prisma.$transaction(async (tx) => {
      // Capacity re-check inside the txn (staff-aware) to prevent races / oversell.
      const settings = await tx.salonSettings.findUnique({ where: { id: "singleton" } });
      const capacity = data.staffId ? 1 : settings?.capacity ?? 3;
      const overlapping = await tx.booking.count({
        where: { status: "CONFIRMED", startAt: { lt: end }, endAt: { gt: start }, ...(data.staffId ? { staffId: data.staffId } : {}) },
      });
      if (overlapping >= capacity) throw new Error("CAPACITY_FULL");

      return tx.booking.create({
        data: {
          serviceId: services[0].id,
          serviceName: summaryName,
          priceAED: totalPrice,
          durationMin: totalDuration,
          customerName: data.customerName.trim(),
          email: emailClean,
          phone: phoneClean,
          notes: data.notes?.trim() || null,
          startAt: start,
          endAt: end,
          status: "CONFIRMED",
          locale: data.locale ?? "en",
          staffId: data.staffId || null,
          clientId,
          serviceMode: data.serviceMode ?? "SALON",
          address: data.serviceMode === "HOME" ? data.address?.trim() || null : null,
          customRequest: data.customRequest?.trim() || null,
          items: {
            create: services.map((s) => ({ serviceId: s.id, serviceName: s.name, priceAED: s.priceAED, durationMin: s.durationMin, staffId: data.staffId || null })),
          },
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "CAPACITY_FULL" || msg.includes("40001") || msg.includes("could not serialize")) {
      return NextResponse.json({ error: check.reason ?? "That time was just taken. Please pick another slot.", code: "SLOT_TAKEN" }, { status: 409 });
    }
    console.error("[bookings] create failed:", e);
    return NextResponse.json({ error: "Could not complete booking. Please try again." }, { status: 500 });
  }

  const ref = "QA-" + booking.id.slice(-8).toUpperCase();

  let customerEmailed = false;
  try {
    const r = await sendBookingEmails({
      customerName: booking.customerName, email: booking.email, phone: booking.phone,
      serviceName: services.map((s) => s.name).join(", "), priceAED: booking.priceAED,
      whenLabel: dubaiLabel(start), notes: booking.notes, serviceMode: booking.serviceMode, address: booking.address, customRequest: booking.customRequest,
      ref,
    });
    customerEmailed = r.customerEmailed;
  } catch (e) { console.error("[bookings] email send failed (booking still saved):", e); }

  return NextResponse.json({
    ok: true,
    emailWarning: customerEmailed ? null : "Your booking is saved, but the confirmation email may be delayed — we'll also reach you on WhatsApp.",
    booking: { id: booking.id, ref, serviceName: booking.serviceName, whenLabel: dubaiLabel(start), priceAED: booking.priceAED },
  });
}
