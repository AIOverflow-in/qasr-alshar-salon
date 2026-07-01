import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { renderInvoice } from "@/lib/invoice";
import { invoiceToken } from "@/lib/invoice-token";
import { sendInvoiceEmail } from "@/lib/email";
import { resolveClientId } from "@/lib/clients";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

const VAT_PCT = 5;

const lineSchema = z.object({
  kind: z.enum(["SERVICE", "PRODUCT"]),
  description: z.string().min(1),
  qty: z.number().int().positive(),
  unitAED: z.number().int().nonnegative(),
  productId: z.string().optional().nullable(),
  staffId: z.string().optional().nullable(), // legacy single artist
  staffIds: z.array(z.string()).optional().nullable(), // artists who performed THIS line (split equally)
});

const createSchema = z.object({
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER"]).default("CASH"),
  // Split payment: when true, cash+card+transfer must add up to the total.
  splitPayment: z.boolean().optional(),
  cashAED: z.number().int().nonnegative().optional(),
  cardAED: z.number().int().nonnegative().optional(),
  transferAED: z.number().int().nonnegative().optional(),
  // Per-artist agreed commission overrides (AED). Omitted artists auto-compute from their %.
  commissions: z.array(z.object({ staffId: z.string().min(1), amountAED: z.number().int().nonnegative() })).optional(),
  marketerAmountAED: z.number().int().nonnegative().optional(), // agreed marketer commission; overrides the 5% default
  bookingId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  // When no client is picked, these link/create one so the bill isn't "Walk-in".
  customerName: z.string().max(120).optional().nullable(),
  customerPhone: z.string().max(30).optional().nullable(),
  customerEmail: z.string().optional().nullable(),
  staffId: z.string().optional().nullable(),
  marketerId: z.string().optional().nullable(),
  marketerPct: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(500).optional().nullable(),
  clientRequestId: z.string().max(64).optional().nullable(), // idempotency key (one per cart)
  lines: z.array(lineSchema).min(1),
});

/** True when a Prisma error is a unique-constraint violation on the given field. */
function isUniqueOn(e: unknown, field: string): boolean {
  const err = e as { code?: string; meta?: { target?: unknown } };
  if (err?.code !== "P2002") return false;
  const t = err.meta?.target;
  return Array.isArray(t) ? t.includes(field) : typeof t === "string" && t.includes(field);
}

/** True when a transaction failed on a write-conflict / serialization error (safe to retry). */
function isSerializationError(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === "P2034" || (typeof err?.message === "string" && err.message.includes("40001"));
}

/**
 * Recompute commissions for an order inside a transaction. Commission is on SERVICES ONLY
 * (products don't earn it): a SALES_SPLIT per artist (their service-line totals × their %),
 * plus a REFERRAL for the marketer on the service value. Each artist's amount auto-fills from
 * their %, but a per-artist override (agreed at billing) takes precedence.
 */
async function writeCommissions(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  orderId: string,
  lines: { kind: string; lineAED: number; staffId?: string | null; staffIds?: string[] | null }[],
  orderStaffId: string | null,
  marketerId: string | null,
  marketerPct: number,
  overrides: Map<string, number>, // staffId → agreed commission amount (AED)
  marketerAmount?: number, // agreed marketer/referral commission (AED); overrides the % default
) {
  const baseByStaff = new Map<string, number>();
  let servicesSubtotal = 0;
  for (const l of lines) {
    if (l.kind !== "SERVICE") continue; // commission is on services only
    servicesSubtotal += l.lineAED;
    // Artists for this line: the multi-list, else the single, else the order's main artist.
    const artists = (l.staffIds && l.staffIds.length) ? l.staffIds : (l.staffId ? [l.staffId] : (orderStaffId ? [orderStaffId] : []));
    if (!artists.length) continue;
    const share = l.lineAED / artists.length; // split a shared line equally
    for (const sid of artists) baseByStaff.set(sid, (baseByStaff.get(sid) ?? 0) + share);
  }
  for (const [sid, base] of baseByStaff) {
    const staff = await tx.staff.findUnique({ where: { id: sid }, select: { commissionPct: true } });
    if (!staff) continue;
    const auto = Math.round(base * staff.commissionPct / 100);
    const override = overrides.get(sid);
    const amountAED = override != null ? override : auto;
    // Record the effective % so the stored pct still explains the amount.
    const pct = base > 0 ? Math.round((amountAED / base) * 100) : staff.commissionPct;
    await tx.commission.create({ data: { staffId: sid, orderId, type: "SALES_SPLIT", baseAED: Math.round(base), pct, amountAED } });
  }
  if (marketerId) {
    const referral = marketerAmount != null ? marketerAmount : Math.round(servicesSubtotal * marketerPct / 100);
    if (referral > 0) {
      const pct = servicesSubtotal > 0 ? Math.round((referral / servicesSubtotal) * 100) : marketerPct;
      await tx.commission.create({ data: { staffId: marketerId, orderId, type: "REFERRAL", baseAED: servicesSubtotal, pct, amountAED: referral } });
    }
  }
}

/**
 * Keep a linked booking in sync with its bill: the booking's items, price, duration,
 * artist and marketer mirror the bill's SERVICE lines (products don't belong on a booking).
 * `complete` marks the booking COMPLETED — used the moment a booking is billed.
 */
async function syncBookingToBill(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  bookingId: string,
  serviceLines: { description: string; lineAED: number; staffId?: string | null; staffIds?: string[] | null }[],
  orderStaffId: string | null,
  marketerId: string | null,
  complete: boolean,
) {
  if (!serviceLines.length) return; // nothing to mirror (e.g. a product-only edit)
  const svcByName = new Map((await tx.service.findMany({ select: { id: true, name: true, durationMin: true } })).map((s) => [s.name, s]));
  const items = serviceLines.map((l) => {
    const svc = svcByName.get(l.description);
    return { serviceId: svc?.id ?? null, serviceName: l.description, priceAED: l.lineAED, durationMin: svc?.durationMin ?? 0, staffId: (l.staffIds && l.staffIds[0]) || l.staffId || orderStaffId || null };
  });
  const dur = items.reduce((s, i) => s + i.durationMin, 0);
  const price = items.reduce((s, i) => s + i.priceAED, 0);
  const summary = items.length === 1 ? items[0].serviceName : `${items[0].serviceName} +${items.length - 1} more`;
  const bk = await tx.booking.findUnique({ where: { id: bookingId }, select: { startAt: true } });
  await tx.bookingItem.deleteMany({ where: { bookingId } });
  await tx.booking.update({
    where: { id: bookingId },
    data: {
      serviceId: items[0].serviceId, serviceName: summary, priceAED: price, durationMin: dur,
      ...(bk ? { endAt: new Date(bk.startAt.getTime() + dur * 60_000) } : {}),
      staffId: orderStaffId ?? null, marketerId: marketerId ?? null,
      ...(complete ? { status: "COMPLETED" as const } : {}),
      items: { create: items },
    },
  });
}

const editSchema = createSchema.extend({ orderId: z.string().min(1) });

type Method = "CASH" | "CARD" | "TRANSFER";
type PaymentInput = { paymentMethod: Method; splitPayment?: boolean; cashAED?: number; cardAED?: number; transferAED?: number };

/**
 * Resolve how a bill is paid. Single method → that method, split columns 0.
 * Split → the per-method amounts (which must add up to the total), with paymentMethod
 * set to the dominant method so single-value consumers still read sensibly.
 */
function resolvePayment(data: PaymentInput, total: number):
  | { splitPayment: boolean; cashAED: number; cardAED: number; transferAED: number; paymentMethod: Method }
  | { error: string } {
  if (!data.splitPayment) {
    return { splitPayment: false, cashAED: 0, cardAED: 0, transferAED: 0, paymentMethod: data.paymentMethod };
  }
  const cashAED = data.cashAED ?? 0, cardAED = data.cardAED ?? 0, transferAED = data.transferAED ?? 0;
  const sum = cashAED + cardAED + transferAED;
  if (sum !== total) return { error: `Split payments (AED ${sum}) must add up to the total (AED ${total}).` };
  const pairs: [Method, number][] = [["CASH", cashAED], ["CARD", cardAED], ["TRANSFER", transferAED]];
  const paymentMethod = pairs.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  return { splitPayment: true, cashAED, cardAED, transferAED, paymentMethod };
}

/** Email the finished/updated invoice to the client (best-effort, never throws). */
async function emailInvoice(orderId: string) {
  try {
    const full = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { lines: true, client: { select: { name: true, phone: true, email: true } }, staff: { select: { name: true } } },
    });
    if (full?.client?.email) {
      const pdf = await renderInvoice(full);
      const token = invoiceToken(full.invoiceNo);
      await sendInvoiceEmail({
        invoiceNo: full.invoiceNo,
        clientName: full.client.name,
        clientEmail: full.client.email,
        totalAED: full.totalAED,
        publicUrl: `${SITE.url}/api/invoice/${full.invoiceNo}?t=${token}`,
        pdf,
      });
    }
  } catch (e) {
    console.error("[pos] invoice email failed (non-fatal):", e);
  }
}

async function nextInvoiceNo(): Promise<string> {
  const now = new Date();
  const dubaiISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
  }).format(now);
  const prefix = `QA-${dubaiISO.replace("-", "")}-`;
  const last = await prisma.salesOrder.findFirst({
    where: { invoiceNo: { startsWith: prefix } },
    orderBy: { invoiceNo: "desc" },
    select: { invoiceNo: true },
  });
  const seq = last ? parseInt(last.invoiceNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed: string[] = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });

  const data = parsed.data;

  const lines = data.lines.map((l) => ({
    ...l,
    lineAED: l.qty * l.unitAED,
    productId: l.productId ?? null,
  }));
  const subtotal = lines.reduce((s, l) => s + l.lineAED, 0);
  const vatAED = Math.round(subtotal * VAT_PCT / 100);
  const total = subtotal + vatAED;

  const pay = resolvePayment(data, total);
  if ("error" in pay) return NextResponse.json({ error: pay.error }, { status: 400 });

  // Link a client so the bill isn't "Walk-in": use the chosen one, else dedupe/create from the name.
  const clientId = data.clientId
    ?? (data.customerName?.trim()
      ? await resolveClientId({ name: data.customerName, phone: (data.customerPhone ?? "").trim(), email: (data.customerEmail ?? "").trim().toLowerCase() })
      : null);

  // Idempotent replay: this exact cart was already charged → return that invoice.
  if (data.clientRequestId) {
    const dupe = await prisma.salesOrder.findUnique({
      where: { clientRequestId: data.clientRequestId },
      select: { id: true, invoiceNo: true, totalAED: true },
    });
    if (dupe) return NextResponse.json({ ok: true, order: dupe, idempotent: true });
  }

  // Create with a retry loop: invoice-number collisions and serialization
  // conflicts under concurrent checkouts are recoverable (just try again).
  let order: { id: string; invoiceNo: string; totalAED: number } | null = null;
  for (let attempt = 0; attempt < 5 && !order; attempt++) {
    const invoiceNo = await nextInvoiceNo();
    try {
      order = await prisma.$transaction(async (tx) => {
        // Guard: never bill the same booking twice (two receptionists racing "Bill").
        if (data.bookingId) {
          const billed = await tx.salesOrder.findFirst({ where: { bookingId: data.bookingId, status: "PAID" }, select: { id: true } });
          if (billed) throw new Error("ALREADY_BILLED");
        }

        const created = await tx.salesOrder.create({
          data: {
            invoiceNo,
            clientRequestId: data.clientRequestId ?? null,
            createdById: session.sub,
            status: "PAID",
            paymentMethod: pay.paymentMethod,
            splitPayment: pay.splitPayment,
            cashAED: pay.cashAED,
            cardAED: pay.cardAED,
            transferAED: pay.transferAED,
            bookingId: data.bookingId ?? null,
            clientId,
            staffId: data.staffId ?? null,
            marketerId: data.marketerId ?? null,
            marketerPct: data.marketerPct ?? 5,
            subtotalAED: subtotal,
            vatPct: VAT_PCT,
            vatAED,
            totalAED: total,
            notes: data.notes ?? null,
            paidAt: new Date(),
            lines: {
              create: lines.map((l) => ({
                kind: l.kind,
                description: l.description,
                qty: l.qty,
                unitAED: l.unitAED,
                lineAED: l.lineAED,
                productId: l.productId ?? null,
                staffId: l.staffId ?? null,
                staffIds: l.staffIds ?? [],
              })),
            },
          },
          select: { id: true, invoiceNo: true, totalAED: true },
        });

        // Atomic conditional decrement — can't oversell even under concurrency.
        for (const l of lines.filter((x) => x.kind === "PRODUCT" && x.productId)) {
          const res = await tx.product.updateMany({
            where: { id: l.productId!, qty: { gte: l.qty } },
            data: { qty: { decrement: l.qty } },
          });
          if (res.count === 0) {
            const prod = await tx.product.findUnique({ where: { id: l.productId! }, select: { name: true } });
            throw new Error(`OUT_OF_STOCK:${prod?.name ?? "item"}`);
          }
          await tx.stockMovement.create({
            data: { productId: l.productId!, kind: "SALE", qty: -l.qty, note: `Invoice ${invoiceNo}`, staffId: data.staffId ?? null },
          });
        }

        if (clientId) {
          await tx.client.update({
            where: { id: clientId },
            data: { visits: { increment: 1 }, totalSpentAED: { increment: total } },
          });
        }

        await writeCommissions(tx, created.id, lines, data.staffId ?? null, data.marketerId ?? null, data.marketerPct ?? 5, new Map((data.commissions ?? []).map((c) => [c.staffId, c.amountAED])), data.marketerAmountAED ?? undefined);

        // Mirror the billed services onto the booking and mark it completed on billing.
        if (data.bookingId) {
          await syncBookingToBill(tx, data.bookingId, lines.filter((x) => x.kind === "SERVICE"), data.staffId ?? null, data.marketerId ?? null, true);
        }

        return created;
      }, { isolationLevel: "Serializable" });
    } catch (e) {
      // Invoice number taken by a concurrent checkout → recompute and retry.
      if (isUniqueOn(e, "invoiceNo") || isSerializationError(e)) continue;
      // Two identical submits raced → return the one that won.
      if (data.clientRequestId && isUniqueOn(e, "clientRequestId")) {
        const existing = await prisma.salesOrder.findUnique({ where: { clientRequestId: data.clientRequestId }, select: { id: true, invoiceNo: true, totalAED: true } });
        if (existing) return NextResponse.json({ ok: true, order: existing, idempotent: true });
      }
      if (e instanceof Error && e.message === "ALREADY_BILLED") {
        return NextResponse.json({ error: "This booking has already been billed." }, { status: 409 });
      }
      if (e instanceof Error && e.message.startsWith("OUT_OF_STOCK:")) {
        return NextResponse.json({ error: `Not enough stock for ${e.message.slice("OUT_OF_STOCK:".length)}.` }, { status: 409 });
      }
      console.error("[pos] checkout failed:", e);
      return NextResponse.json({ error: "Checkout failed. Please try again." }, { status: 500 });
    }
  }

  if (!order) {
    return NextResponse.json({ error: "The system was busy — please try the sale again." }, { status: 409 });
  }

  await emailInvoice(order.id);

  return NextResponse.json({ ok: true, order });
}

// PATCH — edit an existing invoice: reverse old stock/commission/client totals, apply new ones.
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed: string[] = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  const data = parsed.data;

  const lines = data.lines.map((l) => ({ ...l, lineAED: l.qty * l.unitAED, productId: l.productId ?? null }));
  const subtotal = lines.reduce((s, l) => s + l.lineAED, 0);
  const vatAED = Math.round(subtotal * VAT_PCT / 100);
  const total = subtotal + vatAED;

  const pay = resolvePayment(data, total);
  if ("error" in pay) return NextResponse.json({ error: pay.error }, { status: 400 });

  const clientId = data.clientId
    ?? (data.customerName?.trim()
      ? await resolveClientId({ name: data.customerName, phone: (data.customerPhone ?? "").trim(), email: (data.customerEmail ?? "").trim().toLowerCase() })
      : null);

  let done = false;
  for (let attempt = 0; attempt < 5 && !done; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.salesOrder.findUnique({ where: { id: data.orderId }, include: { lines: true } });
        if (!existing) throw new Error("NOT_FOUND");

        // 1. Reverse old product stock
        for (const l of existing.lines.filter((x) => x.kind === "PRODUCT" && x.productId)) {
          await tx.product.update({ where: { id: l.productId! }, data: { qty: { increment: l.qty } } });
          await tx.stockMovement.create({ data: { productId: l.productId!, kind: "ADJUSTMENT", qty: l.qty, note: `Edit reversal ${existing.invoiceNo}` } });
        }
        // 2. Reverse old commission + old client totals
        await tx.commission.deleteMany({ where: { orderId: existing.id } });
        if (existing.clientId) {
          await tx.client.update({ where: { id: existing.clientId }, data: { visits: { decrement: 1 }, totalSpentAED: { decrement: existing.totalAED } } });
        }
        // 3. Replace lines + update order
        await tx.orderLine.deleteMany({ where: { orderId: existing.id } });
        await tx.salesOrder.update({
          where: { id: existing.id },
          data: {
            paymentMethod: pay.paymentMethod,
            splitPayment: pay.splitPayment,
            cashAED: pay.cashAED,
            cardAED: pay.cardAED,
            transferAED: pay.transferAED,
            clientId,
            staffId: data.staffId ?? null,
            marketerId: data.marketerId ?? null,
            marketerPct: data.marketerPct ?? 5,
            notes: data.notes ?? null,
            subtotalAED: subtotal, vatPct: VAT_PCT, vatAED, totalAED: total,
            lines: { create: lines.map((l) => ({ kind: l.kind, description: l.description, qty: l.qty, unitAED: l.unitAED, lineAED: l.lineAED, productId: l.productId ?? null, staffId: l.staffId ?? null, staffIds: l.staffIds ?? [] })) },
          },
        });
        // 4. Apply new product stock — atomic conditional decrement (no oversell)
        for (const l of lines.filter((x) => x.kind === "PRODUCT" && x.productId)) {
          const res = await tx.product.updateMany({ where: { id: l.productId!, qty: { gte: l.qty } }, data: { qty: { decrement: l.qty } } });
          if (res.count === 0) {
            const prod = await tx.product.findUnique({ where: { id: l.productId! }, select: { name: true } });
            throw new Error(`OUT_OF_STOCK:${prod?.name ?? "item"}`);
          }
          await tx.stockMovement.create({ data: { productId: l.productId!, kind: "SALE", qty: -l.qty, note: `Invoice ${existing.invoiceNo} (edited)`, staffId: data.staffId ?? null } });
        }
        // 5. Apply new client totals
        if (clientId) {
          await tx.client.update({ where: { id: clientId }, data: { visits: { increment: 1 }, totalSpentAED: { increment: total } } });
        }
        // 6. Keep the linked booking in sync with the edited bill (services, price, artist, marketer).
        //    Editing an existing bill doesn't change the booking's status.
        if (existing.bookingId) {
          await syncBookingToBill(tx, existing.bookingId, lines.filter((x) => x.kind === "SERVICE"), data.staffId ?? null, data.marketerId ?? null, false);
        }
        // 7. Recompute commissions (per-artist split + marketer referral)
        await writeCommissions(tx, existing.id, lines, data.staffId ?? null, data.marketerId ?? null, data.marketerPct ?? 5, new Map((data.commissions ?? []).map((c) => [c.staffId, c.amountAED])), data.marketerAmountAED ?? undefined);
      }, { isolationLevel: "Serializable" });
      done = true;
    } catch (e) {
      if (isSerializationError(e)) continue; // concurrent edit → retry
      if (e instanceof Error && e.message === "NOT_FOUND") return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      if (e instanceof Error && e.message.startsWith("OUT_OF_STOCK:")) {
        return NextResponse.json({ error: `Not enough stock for ${e.message.slice("OUT_OF_STOCK:".length)}.` }, { status: 409 });
      }
      console.error("[pos] edit failed:", e);
      return NextResponse.json({ error: "Could not update invoice." }, { status: 500 });
    }
  }
  if (!done) return NextResponse.json({ error: "The system was busy — please try the edit again." }, { status: 409 });

  const updated = await prisma.salesOrder.findUnique({ where: { id: data.orderId }, select: { id: true, invoiceNo: true, totalAED: true } });
  await emailInvoice(data.orderId);
  return NextResponse.json({ ok: true, order: updated });
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed: string[] = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const take = Math.min(parseInt(url.searchParams.get("take") ?? "50"), 200);

  const orders = await prisma.salesOrder.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { lines: true, staff: { select: { name: true } }, client: { select: { name: true } } },
  });

  return NextResponse.json({ orders });
}
