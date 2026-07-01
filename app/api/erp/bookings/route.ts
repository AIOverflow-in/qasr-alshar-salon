import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSlotBookable } from "@/lib/availability";
import { sendBookingEmails } from "@/lib/email";
import { resolveClientId } from "@/lib/clients";

export const dynamic = "force-dynamic";

// Each chosen service carries an optional agreed price (reception can override the menu price per line).
const lineSchema = z.object({
  serviceId: z.string().min(1),
  priceAED: z.number().int().nonnegative().optional().nullable(),
});

const schema = z.object({
  // Multi-service: a list of services, each with an optional per-line price.
  // Falls back to the legacy single serviceId + priceAED so older callers keep working.
  services: z.array(lineSchema).min(1).max(12).optional(),
  serviceId: z.string().min(1).optional(),
  priceAED: z.number().int().nonnegative().optional().nullable(), // legacy single-service override
  startISO: z.string().datetime(),
  staffId: z.string().optional().nullable(),
  marketerId: z.string().optional().nullable(), // Staff who brought the lead (referral)
  // client: either an existing id, or new details (name required)
  clientId: z.string().optional().nullable(),
  customerName: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().max(30).optional().nullable(),
  serviceMode: z.enum(["SALON", "HOME"]).default("SALON"),
  address: z.string().max(400).optional().nullable(),
  notes: z.string().max(800).optional().nullable(),
  enforceAvailability: z.boolean().default(true),
}).refine((d) => (d.services && d.services.length) || d.serviceId, { message: "Pick at least one service." });

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

  // Build the requested line list (preserve the chosen order). New multi-service path or legacy single.
  const requested = d.services?.length
    ? d.services
    : [{ serviceId: d.serviceId!, priceAED: d.priceAED }];

  const ids = requested.map((r) => r.serviceId);
  const found = await prisma.service.findMany({ where: { id: { in: ids } } });
  // Each line keeps its agreed price (override) or falls back to the menu price.
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
  const start = new Date(d.startISO);
  const end = new Date(start.getTime() + totalDuration * 60_000);

  // Availability is enforced (per-stylist) for FUTURE bookings; reception can override for
  // walk-ins/phone. Past times are always allowed in-store — a walk-in is recording a
  // here-and-now (or just-finished) visit, which the future-only slot check would reject.
  const isFuture = start.getTime() > Date.now();
  if (d.enforceAvailability && isFuture) {
    const check = await isSlotBookable(d.startISO, totalDuration, d.staffId || undefined);
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 });
  }

  // Resolve the client: use the chosen one, else dedupe-create from the details.
  const phone = (d.phone ?? "").trim();
  const email = (d.email ?? "").trim().toLowerCase();
  const clientId = d.clientId ?? (await resolveClientId({ name: d.customerName, phone, email }));

  const booking = await prisma.booking.create({
    data: {
      serviceId: lines[0].svc.id, serviceName: summaryName, priceAED: totalPrice, durationMin: totalDuration,
      customerName: d.customerName.trim(), email: email || "", phone: phone || "",
      notes: d.notes?.trim() || null, startAt: start, endAt: end, status: "CONFIRMED",
      staffId: d.staffId || null, marketerId: d.marketerId || null, clientId, source: "WALKIN", createdById: session.sub,
      serviceMode: d.serviceMode, address: d.serviceMode === "HOME" ? d.address?.trim() || null : null,
      items: { create: lines.map((l) => ({ serviceId: l.svc.id, serviceName: l.svc.name, priceAED: l.price, durationMin: l.svc.durationMin, staffId: d.staffId || null })) },
    },
  });

  if (email) {
    try {
      await sendBookingEmails({ customerName: booking.customerName, email, phone: booking.phone, serviceName: lines.map((l) => l.svc.name).join(", "), priceAED: booking.priceAED, whenLabel: dubaiLabel(start), notes: booking.notes, serviceMode: booking.serviceMode, address: booking.address });
    } catch (e) { console.error("[erp/bookings] email failed:", e); }
  }

  revalidatePath("/erp/bookings");
  revalidatePath("/erp");
  return NextResponse.json({ ok: true, booking: { id: booking.id, whenLabel: dubaiLabel(start) } });
}
