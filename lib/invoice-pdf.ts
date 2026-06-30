import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";

const GOLD = rgb(0.78, 0.6, 0.16);
const INK = rgb(0.09, 0.08, 0.06);
const GREY = rgb(0.42, 0.42, 0.42);
const HAIR = rgb(0.85, 0.85, 0.85);
const ROW = rgb(0.97, 0.95, 0.9);

const PAGE_W = 595;
const PAGE_H = 842;
const M = 44;
const RIGHT = PAGE_W - M;

function money(n: number) {
  return `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function num(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export type InvoiceOrder = {
  invoiceNo: string;
  createdAt: Date;
  paymentMethod: string;
  status: string;
  subtotalAED: number;
  vatPct: number;
  vatAED: number;
  totalAED: number;
  notes: string | null;
  lines: { description: string; qty: number; unitAED: number; lineAED: number; staffNames?: string[] }[];
  client: { name: string; phone: string | null; email: string | null } | null;
  staff: { name: string } | null;
};

/** Build the Qasr Alshar tax-invoice PDF. Pure (no DB/auth) so it's unit-testable. */
export async function buildInvoicePdf(order: InvoiceOrder): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);

  let logo: PDFImage | null = null;
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), "public", "brand", "crest.png"));
    logo = await pdf.embedPng(bytes);
  } catch {
    logo = null;
  }

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H;

  const rt = (p: PDFPage, text: string, rightX: number, yy: number, size: number, font: PDFFont, color = INK) =>
    p.drawText(text, { x: rightX - font.widthOfTextAtSize(text, size), y: yy, size, font, color });

  function drawHeader(p: PDFPage) {
    const hy = PAGE_H - M;
    if (logo) {
      const dim = 46;
      const scale = dim / logo.height;
      p.drawImage(logo, { x: M, y: hy - dim, width: logo.width * scale, height: dim });
    }
    const tx = M + (logo ? 58 : 0);
    p.drawText("QASR ALSHAR SALON", { x: tx, y: hy - 14, size: 15, font: bold, color: INK });
    p.drawText("Dalmok Series Building, Exit 2, Union Metro, Deira, Dubai, UAE", { x: tx, y: hy - 28, size: 8, font: reg, color: GREY });
    p.drawText("+971 4 272 7616  ·  hello@qasralshar.ae  ·  @qasr.alshar", { x: tx, y: hy - 40, size: 8, font: reg, color: GREY });
    const trn = process.env.VAT_TRN || "TRN — PENDING";
    rt(p, `TRN: ${trn}`, RIGHT, hy - 14, 8.5, bold, GREY);
    return hy - 60;
  }

  function drawTableHeader(p: PDFPage, yy: number) {
    p.drawRectangle({ x: M, y: yy - 6, width: PAGE_W - 2 * M, height: 22, color: ROW });
    p.drawText("DESCRIPTION", { x: M + 8, y: yy, size: 8, font: bold, color: INK });
    rt(p, "QTY", M + 330, yy, 8, bold, INK);
    rt(p, "UNIT", M + 410, yy, 8, bold, INK);
    rt(p, "AMOUNT", RIGHT - 8, yy, 8, bold, INK);
    return yy - 24;
  }

  y = drawHeader(page);
  page.drawRectangle({ x: M, y, width: PAGE_W - 2 * M, height: 2, color: GOLD });
  y -= 24;

  page.drawText("TAX INVOICE", { x: M, y, size: 20, font: bold, color: INK });
  const metaTop = y + 2;
  const meta: [string, string][] = [
    ["Invoice", order.invoiceNo],
    ["Date", new Date(order.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "short", year: "numeric" })],
    ["Payment", order.paymentMethod],
    ["Status", order.status],
  ];
  let my = metaTop;
  for (const [k, v] of meta) {
    rt(page, `${k}:`, RIGHT - 92, my, 8.5, bold, GREY);
    rt(page, v, RIGHT, my, 8.5, reg, INK);
    my -= 13;
  }
  y -= 28;

  if (order.client || order.staff) {
    page.drawText("BILLED TO", { x: M, y, size: 8, font: bold, color: GOLD });
    y -= 14;
    if (order.client) {
      page.drawText(order.client.name, { x: M, y, size: 10.5, font: bold, color: INK });
      y -= 13;
      const contact = [order.client.phone, order.client.email].filter(Boolean).join("  ·  ");
      if (contact) { page.drawText(contact, { x: M, y, size: 9, font: reg, color: GREY }); y -= 13; }
    }
    if (order.staff) { page.drawText(`Crown Artist: ${order.staff.name}`, { x: M, y, size: 9, font: reg, color: GREY }); y -= 13; }
    y -= 8;
  }

  y = drawTableHeader(page, y);
  for (const line of order.lines) {
    const artists = (line.staffNames ?? []).filter(Boolean);
    const rowH = artists.length ? 30 : 19;
    if (y < 170) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = drawHeader(page);
      y -= 8;
      y = drawTableHeader(page, y);
    }
    const desc = line.description.length > 58 ? line.description.slice(0, 57) + "…" : line.description;
    page.drawText(desc, { x: M + 8, y, size: 9, font: reg, color: INK });
    rt(page, String(line.qty), M + 330, y, 9, reg, INK);
    rt(page, num(line.unitAED), M + 410, y, 9, reg, INK);
    rt(page, num(line.lineAED), RIGHT - 8, y, 9, reg, INK);
    if (artists.length) {
      const by = `by ${artists.join(", ")}`;
      page.drawText(by.length > 70 ? by.slice(0, 69) + "…" : by, { x: M + 8, y: y - 11, size: 7.5, font: reg, color: GREY });
    }
    // Divider sits below this row's content (after the "by artist" line), leaving a
    // gap before the next row's text so the hairline never cuts through it.
    const dividerY = y - (artists.length ? 19 : 8);
    page.drawLine({ start: { x: M, y: dividerY }, end: { x: RIGHT, y: dividerY }, thickness: 0.3, color: HAIR });
    y = dividerY - 11;
  }
  y -= 4;

  const tLabelX = RIGHT - 180;
  const drawTotal = (label: string, val: string, strong = false) => {
    page.drawText(label, { x: tLabelX, y, size: strong ? 10 : 9, font: strong ? bold : reg, color: strong ? INK : GREY });
    rt(page, val, RIGHT - 8, y, strong ? 10 : 9, strong ? bold : reg, INK);
    y -= strong ? 18 : 15;
  };
  drawTotal("Subtotal", money(order.subtotalAED));
  drawTotal(`VAT (${order.vatPct}%)`, money(order.vatAED));
  y -= 14;
  page.drawRectangle({ x: tLabelX - 10, y: y - 4, width: RIGHT - (tLabelX - 10), height: 24, color: INK });
  page.drawText("TOTAL", { x: tLabelX, y: y + 4, size: 11, font: bold, color: GOLD });
  rt(page, money(order.totalAED), RIGHT - 8, y + 4, 11, bold, GOLD);
  y -= 34;

  if (order.notes) {
    page.drawText("Notes", { x: M, y, size: 8, font: bold, color: GREY }); y -= 12;
    page.drawText(order.notes.slice(0, 160), { x: M, y, size: 9, font: reg, color: GREY }); y -= 18;
  }

  const terms = [
    "Terms: Prices include 5% VAT. A 15-minute grace applies; lateness beyond it may incur AED 100 per 30 minutes.",
    "Cancellations within 24 hours and no-shows may be charged. Home-service bookings require prior confirmation.",
    "Full terms & conditions: qasralsharsalon.com/terms",
  ];
  let ty = 96;
  for (const t of terms) { page.drawText(t, { x: M, y: ty, size: 7.5, font: reg, color: GREY }); ty -= 11; }
  page.drawLine({ start: { x: M, y: 60 }, end: { x: RIGHT, y: 60 }, thickness: 1, color: GOLD });
  page.drawText("Thank you for choosing Qasr Alshar Salon — Dubai's Crown of Beauty.", { x: M, y: 44, size: 8.5, font: bold, color: INK });
  page.drawText("@qasr.alshar   ·   @qasralsharsalon   ·   hello@qasralshar.ae", { x: M, y: 31, size: 8, font: reg, color: GREY });

  return pdf.save();
}
