import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";

const GOLD = rgb(0.78, 0.6, 0.16);
const INK = rgb(0.09, 0.08, 0.06);
const GREY = rgb(0.42, 0.42, 0.42);
const HAIR = rgb(0.85, 0.85, 0.85);
const ROW = rgb(0.97, 0.95, 0.9);

const PAGE_W = 595, PAGE_H = 842, M = 44, RIGHT = PAGE_W - M;
const money = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type PayslipData = {
  staffName: string;
  role: string;
  month: string; // "YYYY-MM"
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

  let logo: PDFImage | null = null;
  try {
    logo = await pdf.embedPng(await fs.readFile(path.join(process.cwd(), "public", "brand", "crest.png")));
  } catch { logo = null; }

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const rt = (text: string, rightX: number, yy: number, size: number, font: PDFFont, color = INK) =>
    page.drawText(text, { x: rightX - font.widthOfTextAtSize(text, size), y: yy, size, font, color });

  // header
  let y = PAGE_H - M;
  if (logo) { const dim = 46, s = dim / logo.height; page.drawImage(logo, { x: M, y: y - dim, width: logo.width * s, height: dim }); }
  const tx = M + (logo ? 58 : 0);
  page.drawText("QASR ALSHAR SALON", { x: tx, y: y - 14, size: 15, font: bold, color: INK });
  page.drawText("Dalmok Series Building, Exit 2, Union Metro, Deira, Dubai, UAE", { x: tx, y: y - 28, size: 8, font: reg, color: GREY });
  page.drawText("+971 4 272 7616  ·  hello@qasralshar.ae", { x: tx, y: y - 40, size: 8, font: reg, color: GREY });
  y -= 60;
  page.drawRectangle({ x: M, y, width: PAGE_W - 2 * M, height: 2, color: GOLD });
  y -= 26;

  page.drawText("PAYSLIP", { x: M, y, size: 20, font: bold, color: INK });
  rt(`Period: ${monthLabel(d.month)}`, RIGHT, y + 2, 9, bold, GREY);
  y -= 26;

  // employee
  page.drawText("EMPLOYEE", { x: M, y, size: 8, font: bold, color: GOLD }); y -= 14;
  page.drawText(d.staffName, { x: M, y, size: 11, font: bold, color: INK });
  rt(d.paidAt ? `Paid ${new Date(d.paidAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Dubai" })}` : "Status: Pending", RIGHT, y, 9, reg, d.paidAt ? rgb(0.1, 0.5, 0.2) : GREY);
  y -= 13;
  page.drawText(d.role, { x: M, y, size: 9, font: reg, color: GREY });
  y -= 26;

  // earnings table
  const header = (yy: number) => {
    page.drawRectangle({ x: M, y: yy - 6, width: PAGE_W - 2 * M, height: 22, color: ROW });
    page.drawText("DESCRIPTION", { x: M + 8, y: yy, size: 8, font: bold, color: INK });
    rt("AMOUNT", RIGHT - 8, yy, 8, bold, INK);
    return yy - 24;
  };
  y = header(y);

  const line = (label: string, amount: number, opts?: { neg?: boolean; muted?: boolean }) => {
    page.drawText(label, { x: M + 8, y, size: 9.5, font: reg, color: opts?.muted ? GREY : INK });
    rt(`${opts?.neg ? "−" : ""}${money(amount)}`, RIGHT - 8, y, 9.5, reg, opts?.neg ? rgb(0.6, 0.15, 0.15) : INK);
    y -= 17;
    page.drawLine({ start: { x: M, y: y + 5 }, end: { x: RIGHT, y: y + 5 }, thickness: 0.3, color: HAIR });
  };

  line("Base salary", d.salary);
  line("Sales commission", d.salesCommission);
  line("Referral commission", d.referral);
  if (d.bonus) line("Bonus", d.bonus);
  if (d.deductions) line("Advances & deductions", d.deductions, { neg: true });

  y -= 8;
  const earnings = d.salary + d.salesCommission + d.referral + d.bonus;
  rt("Gross earnings", RIGHT - 8, y, 9, reg, GREY); page.drawText("Gross earnings", { x: M + 8, y, size: 9, font: reg, color: GREY });
  rt(money(earnings), RIGHT - 8, y, 9, reg, INK); y -= 22;

  // net pay box
  page.drawRectangle({ x: M, y: y - 6, width: PAGE_W - 2 * M, height: 30, color: INK });
  page.drawText("NET PAY", { x: M + 10, y: y + 4, size: 12, font: bold, color: GOLD });
  rt(money(d.net), RIGHT - 10, y + 4, 13, bold, GOLD);
  y -= 50;

  page.drawText("This payslip is computed from base salary + sales/referral commission + bonuses, less advances and deductions, for the period shown.", { x: M, y, size: 7.5, font: reg, color: GREY });

  // footer
  page.drawLine({ start: { x: M, y: 60 }, end: { x: RIGHT, y: 60 }, thickness: 1, color: GOLD });
  page.drawText("Qasr Alshar Salon — Dubai's Crown of Beauty.", { x: M, y: 44, size: 8.5, font: bold, color: INK });

  return pdf.save();
}
