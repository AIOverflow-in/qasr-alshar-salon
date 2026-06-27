import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSlotBookable } from "@/lib/availability";
import { sendBookingEmails } from "@/lib/email";
import { resolveClientId } from "@/lib/clients";

export const dynamic = "force-dynamic";

const schema = z.object({
  serviceId: z.string().min(1),
  startISO: z.string().datetime(),
  staffId: z.string().optional().nullable(),
  // client: either an existing id, or new details (name required)
  clientId: z.string().optional().nullable(),
  customerName: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().max(30).optional().nullable(),
  serviceMode: z.enum(["SALON", "HOME"]).default("SALON"),
  address: z.string().max(400).optional().nullable(),
  notes: z.string().max(800).optional().nullable(),
  enforceAvailability: z.boolean().default(true),
});

function dubaiLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please check the details." }, { status: 400 });
  const d = parsed.data;

  const service = await prisma.service.findUnique({ where: { id: d.serviceId } });
  if (!service) return NextResponse.json({ error: "Service not found." }, { status: 404 });

  const start = new Date(d.startISO);
  const end = new Date(start.getTime() + service.durationMin * 60_000);

  // Availability is enforced (per-stylist) for normal bookings; reception can override for walk-ins/phone.
  if (d.enforceAvailability) {
    const check = await isSlotBookable(d.startISO, service.durationMin, d.staffId || undefined);
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 });
  }

  // Resolve the client: use the chosen one, else dedupe-create from the details.
  const phone = (d.phone ?? "").trim();
  const email = (d.email ?? "").trim().toLowerCase();
  const clientId = d.clientId ?? (await resolveClientId({ name: d.customerName, phone, email }));

  const booking = await prisma.booking.create({
    data: {
      serviceId: service.id, serviceName: service.name, priceAED: service.priceAED, durationMin: service.durationMin,
      customerName: d.customerName.trim(), email: email || "", phone: phone || "",
      notes: d.notes?.trim() || null, startAt: start, endAt: end, status: "CONFIRMED",
      staffId: d.staffId || null, clientId, source: "WALKIN",
      serviceMode: d.serviceMode, address: d.serviceMode === "HOME" ? d.address?.trim() || null : null,
      items: { create: [{ serviceId: service.id, serviceName: service.name, priceAED: service.priceAED, durationMin: service.durationMin, staffId: d.staffId || null }] },
    },
  });

  if (email) {
    try {
      await sendBookingEmails({ customerName: booking.customerName, email, phone: booking.phone, serviceName: booking.serviceName, priceAED: booking.priceAED, whenLabel: dubaiLabel(start), notes: booking.notes, serviceMode: booking.serviceMode, address: booking.address });
    } catch (e) { console.error("[erp/bookings] email failed:", e); }
  }

  revalidatePath("/erp/bookings");
  revalidatePath("/erp");
  return NextResponse.json({ ok: true, booking: { id: booking.id, whenLabel: dubaiLabel(start) } });
}
