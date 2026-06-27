import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { invoiceToken } from "@/lib/invoice-token";
import { sendInvoiceEmail } from "@/lib/email";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

const VAT_PCT = 5;

const lineSchema = z.object({
  kind: z.enum(["SERVICE", "PRODUCT"]),
  description: z.string().min(1),
  qty: z.number().int().positive(),
  unitAED: z.number().int().nonnegative(),
  productId: z.string().optional().nullable(),
});

const createSchema = z.object({
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER"]).default("CASH"),
  bookingId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  staffId: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  lines: z.array(lineSchema).min(1),
});

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

  const invoiceNo = await nextInvoiceNo();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.salesOrder.create({
      data: {
        invoiceNo,
        status: "PAID",
        paymentMethod: data.paymentMethod,
        bookingId: data.bookingId ?? null,
        clientId: data.clientId ?? null,
        staffId: data.staffId ?? null,
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
          })),
        },
      },
      include: { lines: true },
    });

    // decrement stock for product lines and record movement
    for (const l of lines.filter((x) => x.kind === "PRODUCT" && x.productId)) {
      await tx.product.update({
        where: { id: l.productId! },
        data: { qty: { decrement: l.qty } },
      });
      await tx.stockMovement.create({
        data: {
          productId: l.productId!,
          kind: "SALE",
          qty: -l.qty,
          note: `Invoice ${invoiceNo}`,
          staffId: data.staffId ?? null,
        },
      });
    }

    // update client totals
    if (data.clientId) {
      await tx.client.update({
        where: { id: data.clientId },
        data: { visits: { increment: 1 }, totalSpentAED: { increment: total } },
      });
    }

    // auto-compute commissions for the assigned stylist
    if (data.staffId) {
      const staff = await tx.staff.findUnique({ where: { id: data.staffId }, select: { commissionPct: true, referralPct: true } });
      if (staff) {
        const commAED = Math.round(subtotal * staff.commissionPct / 100);
        await tx.commission.create({
          data: {
            staffId: data.staffId,
            orderId: created.id,
            type: "SALES_SPLIT",
            baseAED: subtotal,
            pct: staff.commissionPct,
            amountAED: commAED,
          },
        });
      }
    }

    return created;
  });

  // Auto-send the invoice to the client (PDF attached + shareable link). Never blocks/breaks checkout.
  try {
    const full = await prisma.salesOrder.findUnique({
      where: { id: order.id },
      include: {
        lines: true,
        client: { select: { name: true, phone: true, email: true } },
        staff: { select: { name: true } },
      },
    });
    if (full?.client?.email) {
      const pdf = await buildInvoicePdf(full);
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
    console.error("[pos] invoice auto-send failed (non-fatal):", e);
  }

  return NextResponse.json({ ok: true, order: { id: order.id, invoiceNo: order.invoiceNo, totalAED: order.totalAED } });
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const take = Math.min(parseInt(url.searchParams.get("take") ?? "50"), 200);

  const orders = await prisma.salesOrder.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { lines: true, staff: { select: { name: true } }, client: { select: { name: true } } },
  });

  return NextResponse.json({ orders });
}
