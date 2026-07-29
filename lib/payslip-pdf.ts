import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";
import { SITE } from "./site";

const GOLD = rgb(0.62, 0.47, 0.12);   // AA-safe deep gold (matches the site's darkened gold)
const INK = rgb(0.09, 0.08, 0.06);
const GREY = rgb(0.42, 0.42, 0.42);
const FAINT = rgb(0.6, 0.6, 0.6);
const HAIR = rgb(0.85, 0.85, 0.85);
const ROW = rgb(0.97, 0.95, 0.9);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 595, PAGE_H = 842, M = 48, RIGHT = PAGE_W - M;
const money = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type PayslipData = {
  staffName: string;
  role: string;
  month: string; // "YYYY-MM"
  clientsServed: number;
  grossAED: number;   // gross clients paid (incl 5% VAT)
  netSaleAED: number; // net service sales (ex VAT)
  salary: number;
  salesCommission: number;
  referral: number;
  bonus: number;
  deductions: number;
  net: number;
  paidAt: string | null;
};

function monthLabel(m: string) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export async function buildPayslipPdf(d: PayslipData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let logo: PDFImage | null = null;
  try {
    logo = await pdf.embedPng(await fs.readFile(path.join(process.cwd(), "public", "brand", "crest.png")));
  } catch { logo = null; }

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const text = (s: string, x: number, yy: number, size: number, font: PDFFont, color = INK, spacing = 0) =>
    page.drawText(s, { x, y: yy, size, font, color, ...(spacing ? { characterSpacing: spacing } : {}) });
  const rt = (s: string, rightX: number, yy: number, size: number, font: PDFFont, color = INK, spacing = 0) =>
    page.drawText(s, { x: rightX - font.widthOfTextAtSize(s, size) - spacing * s.length, y: yy, size, font, color, ...(spacing ? { characterSpacing: spacing } : {}) });
  const ctr = (s: string, cx: number, yy: number, size: number, font: PDFFont, color = INK, spacing = 0) =>
    page.drawText(s, { x: cx - (font.widthOfTextAtSize(s, size) + spacing * (s.length - 1)) / 2, y: yy, size, font, color, ...(spacing ? { characterSpacing: spacing } : {}) });

  // ── Letterhead ─────────────────────────────────────────────────────────────
  let y = PAGE_H - M;
  if (logo) { const dim = 52, s = dim / logo.height; page.drawImage(logo, { x: M, y: y - dim, width: logo.width * s, height: dim }); }
  const tx = M + (logo ? 66 : 0);
  text("QASR ALSHAR SALON", tx, y - 16, 16, bold, INK, 1.2);
  text("Dubai's Crown of Beauty", tx, y - 31, 9, italic, GOLD);
  text("Dalmok Series Building, Exit 2, Union Metro, Deira, Dubai, UAE", tx, y - 45, 7.5, reg, GREY);
  // Document label, right-aligned
  rt("PAYSLIP", RIGHT, y - 8, 11, bold, GOLD, 3);
  rt("Salary statement", RIGHT, y - 22, 8, reg, GREY);
  rt(monthLabel(d.month), RIGHT, y - 36, 9.5, bold, INK);
  y -= 66;
  page.drawRectangle({ x: M, y, width: PAGE_W - 2 * M, height: 2, color: GOLD });
  y -= 30;

  // ── Employee band ────────────────────────────────────────────────────────────
  page.drawRectangle({ x: M, y: y - 40, width: PAGE_W - 2 * M, height: 58, color: ROW });
  text("EMPLOYEE", M + 14, y + 4, 7, bold, GOLD, 1.5);
  text(d.staffName, M + 14, y - 14, 14, bold, INK);
  text(d.role, M + 14, y - 30, 9, reg, GREY);
  const paid = !!d.paidAt;
  const statusTxt = paid
    ? `Paid ${new Date(d.paidAt as string).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Dubai" })}`
    : "Payment pending";
  const sc = paid ? rgb(0.12, 0.45, 0.2) : rgb(0.7, 0.45, 0.1);
  // status pill
  const pillW = reg.widthOfTextAtSize(statusTxt, 8) + 20;
  page.drawRectangle({ x: RIGHT - 14 - pillW, y: y - 24, width: pillW, height: 16, color: paid ? rgb(0.9, 0.96, 0.9) : rgb(0.99, 0.95, 0.86), borderColor: sc, borderWidth: 0.5 });
  ctr(statusTxt, RIGHT - 14 - pillW / 2, y - 20, 8, bold, sc);
  y -= 66;

  // ── Performance this period ─────────────────────────────────────────────────
  text("PERFORMANCE THIS PERIOD", M, y, 7.5, bold, GOLD, 1.2); y -= 18;
  const stats: [string, string][] = [
    ["Clients served", String(d.clientsServed)],
    ["Gross collected (incl. VAT)", money(d.grossAED)],
    ["Net service sales (ex-VAT)", money(d.netSaleAED)],
  ];
  const gap = 12, tileW = (PAGE_W - 2 * M - 2 * gap) / 3, tileH = 46;
  stats.forEach(([label, val], i) => {
    const x = M + i * (tileW + gap);
    page.drawRectangle({ x, y: y - tileH + 14, width: tileW, height: tileH, borderColor: HAIR, borderWidth: 0.75 });
    page.drawRectangle({ x, y: y + 10, width: tileW, height: 3, color: GOLD }); // gold cap
    text(label.toUpperCase(), x + 10, y - 6, 6.5, bold, FAINT, 0.5);
    text(val, x + 10, y - 24, 13, bold, INK);
  });
  y -= tileH + 26;

  // ── Earnings breakdown ───────────────────────────────────────────────────────
  text("EARNINGS & DEDUCTIONS", M, y, 7.5, bold, GOLD, 1.2); y -= 16;
  page.drawRectangle({ x: M, y: y - 6, width: PAGE_W - 2 * M, height: 22, color: INK });
  text("DESCRIPTION", M + 12, y, 7.5, bold, WHITE, 0.5);
  rt("AMOUNT", RIGHT - 12, y, 7.5, bold, WHITE, 0.5);
  y -= 26;

  const line = (label: string, amount: number, opts?: { neg?: boolean; muted?: boolean; strong?: boolean; note?: string }) => {
    const f = opts?.strong ? bold : reg;
    text(label, M + 12, y, opts?.strong ? 10 : 9.5, f, opts?.muted ? GREY : INK);
    if (opts?.note) text(opts.note, M + 12 + f.widthOfTextAtSize(label, opts?.strong ? 10 : 9.5) + 8, y, 7.5, italic, FAINT);
    rt(`${opts?.neg ? "- " : ""}${money(amount)}`, RIGHT - 12, y, opts?.strong ? 10 : 9.5, f, opts?.neg ? rgb(0.6, 0.15, 0.15) : INK);
    y -= 20;
    page.drawLine({ start: { x: M, y: y + 8 }, end: { x: RIGHT, y: y + 8 }, thickness: 0.4, color: HAIR });
  };

  // Base salary is a guaranteed floor: the artist earns the HIGHER of base or sales commission.
  const servicePay = Math.max(d.salary, d.salesCommission);
  const commissionWins = d.salesCommission > d.salary;
  line("Base salary (guaranteed floor)", d.salary, { muted: true });
  line("Sales commission", d.salesCommission, { muted: true });
  line(
    commissionWins ? "Service pay — sales commission" : "Service pay — base salary",
    servicePay,
    { strong: true, note: commissionWins ? "commission beats the floor" : "floor applied" },
  );
  line("Referral commission", d.referral);
  if (d.bonus) line("Bonus", d.bonus);
  if (d.deductions) line("Advances & deductions", d.deductions, { neg: true });

  // Gross earnings subtotal
  y -= 6;
  const earnings = servicePay + d.referral + d.bonus;
  text("Gross earnings", M + 12, y, 9, reg, GREY);
  rt(money(earnings), RIGHT - 12, y, 9, reg, INK);
  y -= 30;

  // ── Net pay hero ───────────────────────────────────────────────────────────
  const heroH = 46;
  page.drawRectangle({ x: M, y: y - heroH + 16, width: PAGE_W - 2 * M, height: heroH, color: INK });
  page.drawRectangle({ x: M, y: y - heroH + 16, width: 4, height: heroH, color: GOLD }); // gold edge
  text("NET PAY", M + 18, y - 2, 10, bold, GOLD, 2);
  text("Amount payable to the employee for this period", M + 18, y - 16, 7.5, reg, rgb(0.75, 0.72, 0.66));
  rt(money(d.net), RIGHT - 18, y - 10, 18, bold, WHITE);
  y -= heroH + 22;

  text(
    "Pay is calculated as the higher of base salary or sales commission, plus referral commission and any bonus,",
    M, y, 7.5, italic, GREY,
  ); y -= 11;
  text("less advances and deductions, for the period shown above.", M, y, 7.5, italic, GREY);

  // ── Footer ───────────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: M, y: 66 }, end: { x: RIGHT, y: 66 }, thickness: 1, color: GOLD });
  text(SITE.legal.name, M, 50, 8, bold, INK);
  text(`Licence ${SITE.legal.licenseNo} · ${SITE.legal.address}`, M, 39, 7, reg, GREY);
  rt("Confidential — for the named employee only.", RIGHT, 50, 7.5, italic, FAINT);
  rt("This is a computer-generated statement.", RIGHT, 39, 7, reg, FAINT);

  return pdf.save();
}
