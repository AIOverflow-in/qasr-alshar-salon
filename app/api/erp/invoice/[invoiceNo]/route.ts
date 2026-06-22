import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GOLD = rgb(0.8, 0.65, 0.2);
const BLACK = rgb(0, 0, 0);
const GREY = rgb(0.4, 0.4, 0.4);
const LIGHT = rgb(0.96, 0.94, 0.9);

function fmtAED(fils: number) {
  return `AED ${(fils / 100).toFixed(2)}`;
}
function fmtAEDRaw(whole: number) {
  return `AED ${whole.toFixed(2)}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ invoiceNo: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed: string[] = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { invoiceNo } = await params;

  const order = await prisma.salesOrder.findUnique({
    where: { invoiceNo },
    include: {
      lines: true,
      client: { select: { name: true, phone: true, email: true } },
      staff: { select: { name: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  // Build PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = height - 40;

  // ── Header bar ────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: BLACK });

  page.drawText("QASR ALSHAR SALON", {
    x: 40, y: height - 42,
    size: 18, font: bold, color: GOLD,
  });
  page.drawText("Dalmok Series Building, Exit 2, Union Metro, Dubai, UAE", {
    x: 40, y: height - 58,
    size: 8.5, font: regular, color: rgb(0.85, 0.85, 0.85),
  });
  page.drawText("Tel: +971 4 272 7616  |  hello@qasralshar.ae", {
    x: 40, y: height - 71,
    size: 8.5, font: regular, color: rgb(0.85, 0.85, 0.85),
  });

  const trn = process.env.VAT_TRN || "TRN — PENDING";
  page.drawText(`TRN: ${trn}`, {
    x: width - 200, y: height - 58,
    size: 8.5, font: regular, color: rgb(0.85, 0.85, 0.85),
  });

  y = height - 110;

  // ── Title + invoice meta ───────────────────────────────────────────────────
  page.drawText("TAX INVOICE", {
    x: 40, y,
    size: 22, font: bold, color: BLACK,
  });

  const metaX = width - 220;
  const meta = [
    ["Invoice #", order.invoiceNo],
    ["Date", new Date(order.createdAt).toLocaleDateString("en-AE", { timeZone: "Asia/Dubai", day: "2-digit", month: "short", year: "numeric" })],
    ["Payment", order.paymentMethod],
    ["Status", order.status],
  ];
  let metaY = y;
  for (const [label, val] of meta) {
    page.drawText(`${label}:`, { x: metaX, y: metaY, size: 9, font: bold, color: GREY });
    page.drawText(val, { x: metaX + 70, y: metaY, size: 9, font: regular, color: BLACK });
    metaY -= 15;
  }

  y -= 45;

  // ── Client / Stylist block ────────────────────────────────────────────────
  if (order.client || order.staff) {
    page.drawText("BILLED TO", { x: 40, y, size: 8, font: bold, color: GOLD });
    y -= 14;
    if (order.client) {
      page.drawText(order.client.name, { x: 40, y, size: 10, font: bold, color: BLACK });
      y -= 13;
      if (order.client.phone) {
        page.drawText(order.client.phone, { x: 40, y, size: 9, font: regular, color: GREY });
        y -= 13;
      }
    }
    if (order.staff) {
      page.drawText(`Crown Artist: ${order.staff.name}`, { x: 40, y, size: 9, font: regular, color: GREY });
      y -= 13;
    }
    y -= 8;
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: GOLD });
  y -= 18;

  // ── Line items header ─────────────────────────────────────────────────────
  page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 20, color: LIGHT });
  const cols = { desc: 40, qty: 320, unit: 390, total: 490 };
  page.drawText("Description", { x: cols.desc + 4, y: y + 3, size: 9, font: bold, color: BLACK });
  page.drawText("Qty", { x: cols.qty, y: y + 3, size: 9, font: bold, color: BLACK });
  page.drawText("Unit (AED)", { x: cols.unit, y: y + 3, size: 9, font: bold, color: BLACK });
  page.drawText("Total (AED)", { x: cols.total, y: y + 3, size: 9, font: bold, color: BLACK });
  y -= 20;

  // ── Line items ────────────────────────────────────────────────────────────
  for (const line of order.lines) {
    page.drawText(line.description, { x: cols.desc, y, size: 9, font: regular, color: BLACK, maxWidth: 270 });
    page.drawText(String(line.qty), { x: cols.qty, y, size: 9, font: regular, color: BLACK });
    page.drawText(line.unitAED.toFixed(2), { x: cols.unit, y, size: 9, font: regular, color: BLACK });
    page.drawText(line.lineAED.toFixed(2), { x: cols.total, y, size: 9, font: regular, color: BLACK });
    y -= 16;
    if (y < 150) {
      // Add a new page if needed (basic overflow protection)
      break;
    }
  }

  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });
  y -= 14;

  // ── Totals ────────────────────────────────────────────────────────────────
  const totRows: [string, string][] = [
    ["Subtotal", fmtAEDRaw(order.subtotalAED)],
    [`VAT (${order.vatPct}%)`, fmtAEDRaw(order.vatAED)],
  ];
  for (const [label, val] of totRows) {
    page.drawText(label, { x: width - 200, y, size: 9, font: regular, color: GREY });
    page.drawText(val, { x: width - 110, y, size: 9, font: regular, color: BLACK });
    y -= 14;
  }

  // Total row highlighted
  page.drawRectangle({ x: width - 210, y: y - 4, width: 170, height: 20, color: BLACK });
  page.drawText("TOTAL", { x: width - 200, y: y + 3, size: 10, font: bold, color: GOLD });
  page.drawText(fmtAEDRaw(order.totalAED), { x: width - 110, y: y + 3, size: 10, font: bold, color: GOLD });
  y -= 28;

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (order.notes) {
    y -= 10;
    page.drawText("Notes:", { x: 40, y, size: 9, font: bold, color: GREY });
    y -= 13;
    page.drawText(order.notes, { x: 40, y, size: 9, font: regular, color: GREY, maxWidth: 400 });
    y -= 16;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: 40, y: 60 }, end: { x: width - 40, y: 60 }, thickness: 0.5, color: GOLD });
  page.drawText("Thank you for choosing Qasr Alshar Salon — Dubai's Crown of Beauty", {
    x: 40, y: 44, size: 8.5, font: regular, color: GREY,
  });
  page.drawText("@qasr.alshar  |  @qasralsharsalon  |  hello@qasralshar.ae", {
    x: 40, y: 30, size: 8, font: regular, color: rgb(0.6, 0.6, 0.6),
  });

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceNo}.pdf"`,
    },
  });
}
