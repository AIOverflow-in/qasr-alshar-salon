import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";
import { SITE } from "./site";
import type { PLReport } from "./pl-core";

const GOLD = rgb(0.62, 0.47, 0.12);
const INK = rgb(0.09, 0.08, 0.06);
const GREY = rgb(0.42, 0.42, 0.42);
const FAINT = rgb(0.6, 0.6, 0.6);
const HAIR = rgb(0.85, 0.85, 0.85);
const ROW = rgb(0.97, 0.95, 0.9);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 595, PAGE_H = 842, M = 48, RIGHT = PAGE_W - M;
const money = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type PLPdfMeta = { periodLabel: string; from: string; to: string; generatedLabel: string };

export async function buildProfitAndLossPdf(r: PLReport, meta: PLPdfMeta): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let logo: PDFImage | null = null;
  try { logo = await pdf.embedPng(await fs.readFile(path.join(process.cwd(), "public", "brand", "crest.png"))); } catch { logo = null; }

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const text = (s: string, x: number, yy: number, size: number, font: PDFFont, color = INK, sp = 0) =>
    page.drawText(s, { x, y: yy, size, font, color, ...(sp ? { characterSpacing: sp } : {}) });
  const rt = (s: string, rightX: number, yy: number, size: number, font: PDFFont, color = INK) =>
    page.drawText(s, { x: rightX - font.widthOfTextAtSize(s, size), y: yy, size, font, color });

  // Letterhead
  let y = PAGE_H - M;
  if (logo) { const dim = 52, s = dim / logo.height; page.drawImage(logo, { x: M, y: y - dim, width: logo.width * s, height: dim }); }
  const tx = M + (logo ? 66 : 0);
  text("QASR ALSHAR SALON", tx, y - 16, 16, bold, INK, 1.2);
  text("Dubai's Crown of Beauty", tx, y - 31, 9, italic, GOLD);
  text("Dalmok Series Building, Exit 2, Union Metro, Deira, Dubai, UAE", tx, y - 45, 7.5, reg, GREY);
  rt("PROFIT & LOSS", RIGHT, y - 8, 11, bold, GOLD);
  rt("Statement of income & expenses", RIGHT, y - 22, 8, reg, GREY);
  rt(meta.periodLabel, RIGHT, y - 36, 9.5, bold, INK);
  y -= 66;
  page.drawRectangle({ x: M, y, width: PAGE_W - 2 * M, height: 2, color: GOLD });
  y -= 26;

  const sectionHead = (title: string) => {
    page.drawRectangle({ x: M, y: y - 6, width: PAGE_W - 2 * M, height: 22, color: INK });
    text(title, M + 12, y, 8, bold, WHITE, 0.8);
    rt("AMOUNT", RIGHT - 12, y, 8, bold, WHITE);
    y -= 26;
  };
  const row = (label: string, amount: number, opts?: { strong?: boolean; muted?: boolean; neg?: boolean }) => {
    const f = opts?.strong ? bold : reg;
    if (opts?.strong) { page.drawRectangle({ x: M, y: y - 6, width: PAGE_W - 2 * M, height: 20, color: ROW }); }
    text(label, M + 12, y, opts?.strong ? 10 : 9.5, f, opts?.muted ? GREY : INK);
    rt(`${opts?.neg ? "- " : ""}${money(amount)}`, RIGHT - 12, y, opts?.strong ? 10 : 9.5, f, opts?.neg ? rgb(0.6, 0.15, 0.15) : INK);
    y -= opts?.strong ? 24 : 19;
    if (!opts?.strong) page.drawLine({ start: { x: M, y: y + 8 }, end: { x: RIGHT, y: y + 8 }, thickness: 0.4, color: HAIR });
  };

  // Income
  sectionHead("INCOME");
  if (r.income.length) r.income.forEach((l) => row(l.label, l.amountAED));
  else row("No income recorded in this period", 0, { muted: true });
  row("Total income", r.totalIncome, { strong: true });
  y -= 10;

  // Expenses
  sectionHead("OPERATING EXPENSES");
  if (r.expenses.length) r.expenses.forEach((l) => row(l.label, l.amountAED));
  else row("No expenses recorded in this period", 0, { muted: true });
  row("Total expenses", r.totalExpenses, { strong: true });
  y -= 18;

  // Net profit hero
  const heroH = 48, loss = r.netProfit < 0;
  page.drawRectangle({ x: M, y: y - heroH + 16, width: PAGE_W - 2 * M, height: heroH, color: INK });
  page.drawRectangle({ x: M, y: y - heroH + 16, width: 4, height: heroH, color: GOLD });
  text(loss ? "NET LOSS" : "NET PROFIT", M + 18, y - 2, 11, bold, GOLD, 2);
  text(`Net margin ${r.netMarginPct}% of income`, M + 18, y - 17, 8, reg, rgb(0.75, 0.72, 0.66));
  rt(money(Math.abs(r.netProfit)), RIGHT - 18, y - 10, 18, bold, loss ? rgb(0.95, 0.6, 0.55) : WHITE);
  y -= heroH + 22;

  // Basis note
  text(r.basisNote, M, y, 7.5, italic, GREY); y -= 20;

  // Footer
  page.drawLine({ start: { x: M, y: 66 }, end: { x: RIGHT, y: 66 }, thickness: 1, color: GOLD });
  text(SITE.legal.name, M, 50, 8, bold, INK);
  text(`Licence ${SITE.legal.licenseNo} · CT TRN ${SITE.legal.ctTRN}`, M, 39, 7, reg, GREY);
  rt(`Period ${meta.from} to ${meta.to}`, RIGHT, 50, 7.5, reg, FAINT);
  rt(`Generated ${meta.generatedLabel} · computer-generated`, RIGHT, 39, 7, reg, FAINT);

  return pdf.save();
}
