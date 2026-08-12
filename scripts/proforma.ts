/**
 * Proforma invoice / quotation generator.
 *
 *   node --import tsx scripts/proforma.ts --config proforma.json --out proforma.pdf
 *
 * A proforma is a priced offer, NOT a tax invoice — no money has changed hands, so it must never
 * be numbered in the SalesOrder series or counted as revenue. It becomes a real invoice only when
 * the customer pays and reception rings it up in the POS.
 *
 * Config shape (all money in whole AED):
 * {
 *   "number": "PF-2026-001",
 *   "customer": { "name": "...", "company": "...", "phone": "...", "email": "...", "address": "..." },
 *   "validDays": 14,
 *   "notes": "optional line",
 *   "items": [{ "description": "...", "qty": 36, "listAED": 50, "unitAED": 25 }]
 * }
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";
import { SITE } from "../lib/site";

const GOLD = rgb(0.62, 0.47, 0.12);
const INK = rgb(0.09, 0.08, 0.06);
const GREY = rgb(0.42, 0.42, 0.42);
const FAINT = rgb(0.6, 0.6, 0.6);
const HAIR = rgb(0.85, 0.85, 0.85);
const ROW = rgb(0.97, 0.95, 0.9);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 595, PAGE_H = 842, M = 48, RIGHT = PAGE_W - M;
const money = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plain = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Item = { description: string; qty: number; listAED?: number; unitAED: number };
type Config = {
  number: string;
  customer: { name: string; company?: string; phone?: string; email?: string; address?: string };
  validDays?: number;
  notes?: string;
  items: Item[];
};

const IBAN = process.env.PAY_IBAN || SITE.pay.iban || "AE090351001327056383001";

export async function buildProforma(cfg: Config): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let logo: PDFImage | null = null;
  try { logo = await pdf.embedPng(await fs.readFile(path.join(process.cwd(), "public", "brand", "crest.png"))); } catch { logo = null; }

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const text = (s: string, x: number, y: number, size: number, font: PDFFont, color = INK, sp = 0) =>
    page.drawText(s, { x, y, size, font, color, ...(sp ? { characterSpacing: sp } : {}) });
  const rt = (s: string, rightX: number, y: number, size: number, font: PDFFont, color = INK) =>
    page.drawText(s, { x: rightX - font.widthOfTextAtSize(s, size), y, size, font, color });

  // ── Letterhead ────────────────────────────────────────────────────────────
  let y = PAGE_H - M;
  if (logo) { const dim = 52, s = dim / logo.height; page.drawImage(logo, { x: M, y: y - dim, width: logo.width * s, height: dim }); }
  const tx = M + (logo ? 66 : 0);
  text("QASR ALSHAR SALON", tx, y - 16, 16, bold, INK, 1.2);
  text("Dubai's Crown of Beauty", tx, y - 31, 9, italic, GOLD);
  text(`${SITE.address.line1}, ${SITE.address.city}`, tx, y - 45, 7.5, reg, GREY);
  rt("PROFORMA INVOICE", RIGHT, y - 8, 12, bold, GOLD);
  rt("Quotation — not a tax invoice", RIGHT, y - 22, 8, italic, GREY);
  rt(cfg.number, RIGHT, y - 36, 9.5, bold, INK);
  y -= 66;
  page.drawRectangle({ x: M, y, width: PAGE_W - 2 * M, height: 2, color: GOLD });
  y -= 28;

  // ── Customer + meta ───────────────────────────────────────────────────────
  const issued = new Date();
  const valid = new Date(issued.getTime() + (cfg.validDays ?? 14) * 864e5);
  const d = (x: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" }).format(x);

  page.drawRectangle({ x: M, y: y - 46, width: PAGE_W - 2 * M, height: 64, color: ROW });
  text("PREPARED FOR", M + 14, y + 4, 7, bold, GOLD, 1.5);
  text(cfg.customer.company || cfg.customer.name, M + 14, y - 13, 13, bold, INK);
  const sub = [cfg.customer.company ? cfg.customer.name : "", cfg.customer.phone, cfg.customer.email].filter(Boolean).join("  ·  ");
  if (sub) text(sub, M + 14, y - 27, 8.5, reg, GREY);
  if (cfg.customer.address) text(cfg.customer.address, M + 14, y - 39, 8, reg, GREY);
  rt(`Issued  ${d(issued)}`, RIGHT - 14, y - 13, 8.5, reg, GREY);
  rt(`Valid until  ${d(valid)}`, RIGHT - 14, y - 27, 8.5, bold, INK);
  y -= 74;

  // ── Items ─────────────────────────────────────────────────────────────────
  // Two columns only. Four numeric columns left a big dead gap after short item names and looked
  // sparse; unit price + the struck-through list price read better as a sub-line under the name.
  const C_QTY = M + 372;   // 420
  const C_AMT = RIGHT - 8; // 539
  const ITEM_MAX = C_QTY - (M + 12) - 30;

  /** Trim a string until it fits `max` points, adding an ellipsis. */
  const fit = (s: string, max: number, font: PDFFont, size: number) => {
    if (font.widthOfTextAtSize(s, size) <= max) return s;
    let out = s;
    while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > max) out = out.slice(0, -1);
    return `${out}…`;
  };

  page.drawRectangle({ x: M, y: y - 6, width: PAGE_W - 2 * M, height: 22, color: INK });
  text("ITEM", M + 12, y, 8, bold, WHITE, 0.6);
  rt("QTY", C_QTY, y, 8, bold, WHITE);
  rt("AMOUNT", C_AMT, y, 8, bold, WHITE);
  y -= 28;

  let subtotal = 0, listTotal = 0;
  const ROW_H = 34;
  cfg.items.forEach((it, i) => {
    const line = it.qty * it.unitAED;
    subtotal += line;
    listTotal += it.qty * (it.listAED ?? it.unitAED);
    if (i % 2 === 1) page.drawRectangle({ x: M, y: y - 20, width: PAGE_W - 2 * M, height: ROW_H, color: rgb(0.985, 0.975, 0.955) });

    text(fit(it.description, ITEM_MAX, bold, 10.5), M + 12, y, 10.5, bold, INK);
    rt(String(it.qty), C_QTY, y, 10.5, reg, INK);
    rt(money(line), C_AMT, y, 10.5, bold, INK);

    // Sub-line: the unit price, and what it normally sells for.
    const each = `${plain(it.unitAED)} each`;
    text(each, M + 12, y - 12, 8.5, reg, GREY);
    if (it.listAED && it.listAED !== it.unitAED) {
      const x0 = M + 12 + reg.widthOfTextAtSize(each, 8.5) + 8;
      const was = `was ${plain(it.listAED)}`;
      text(was, x0, y - 12, 8.5, reg, FAINT);
      page.drawLine({ // strike only the number, not the word "was"
        start: { x: x0 + reg.widthOfTextAtSize("was ", 8.5), y: y - 12 + 3 },
        end: { x: x0 + reg.widthOfTextAtSize(was, 8.5), y: y - 12 + 3 },
        thickness: 0.6, color: FAINT,
      });
      const pct = Math.round((1 - it.unitAED / it.listAED) * 100);
      if (pct > 0) text(`· ${pct}% off`, x0 + reg.widthOfTextAtSize(was, 8.5) + 8, y - 12, 8.5, bold, GOLD);
    }
    y -= ROW_H;
  });
  page.drawLine({ start: { x: M, y: y + 16 }, end: { x: RIGHT, y: y + 16 }, thickness: 0.8, color: HAIR });

  // ── Totals ────────────────────────────────────────────────────────────────
  y -= 10;
  const saved = listTotal - subtotal;
  const units = cfg.items.reduce((s, i) => s + i.qty, 0);
  const LBL = RIGHT - 150; // right-edge of the totals labels; values right-align to C_AMT
  text(`${units} items in this order`, M + 12, y, 9, reg, GREY);
  if (saved > 0) {
    rt("Regular price", LBL, y, 9, reg, GREY);
    rt(money(listTotal), C_AMT, y, 9, reg, GREY);
    y -= 16;
    rt("Bulk discount", LBL, y, 9, reg, GREY);
    rt(`- ${money(saved)}`, C_AMT, y, 9, reg, rgb(0.6, 0.15, 0.15));
    y -= 20;
  }
  // Total block spans the same width as the totals column so nothing can overlap the item table.
  const boxX = LBL - 70, heroH = 42;
  page.drawRectangle({ x: boxX, y: y - heroH + 14, width: RIGHT - boxX, height: heroH, color: INK });
  page.drawRectangle({ x: boxX, y: y - heroH + 14, width: 3, height: heroH, color: GOLD });
  text("TOTAL", boxX + 14, y - 6, 11, bold, GOLD, 1.5);
  rt(money(subtotal), C_AMT, y - 8, 14, bold, WHITE);
  y -= heroH + 12;
  if (saved > 0) { rt(`You save ${money(saved)}`, C_AMT, y, 9, bold, GOLD); y -= 20; }

  // ── Payment + terms ───────────────────────────────────────────────────────
  text("TO CONFIRM THIS ORDER", M, y, 7.5, bold, GOLD, 1.2); y -= 15;
  text(`Bank transfer — ${SITE.pay.accountName}`, M, y, 9, reg, INK); y -= 13;
  text(`${SITE.pay.bank}  ·  IBAN ${IBAN}  ·  ${SITE.pay.bic}`, M, y, 8.5, reg, GREY); y -= 13;
  text(`Please quote reference ${cfg.number} with your payment.`, M, y, 8.5, italic, GREY); y -= 20;

  if (cfg.notes) { text(cfg.notes.slice(0, 150), M, y, 8.5, italic, GREY); y -= 16; }

  const terms = [
    `This proforma is a quotation, valid until ${d(valid)}. It is not a tax invoice and no payment is due on it.`,
    "Goods remain available subject to stock at the time of confirmation. A tax invoice follows once payment is received.",
    "Prices are in UAE Dirhams (AED).",
  ];
  let ty = 92;
  for (const t of terms) { text(t, M, ty, 7, reg, GREY); ty -= 9.5; }

  page.drawLine({ start: { x: M, y: 66 }, end: { x: RIGHT, y: 66 }, thickness: 1, color: GOLD });
  text(SITE.legal.name, M, 50, 8, bold, INK);
  // emailAdmin is the address published on the website's contact/footer — keep them identical.
  text(`Licence ${SITE.legal.licenseNo}  ·  ${SITE.phones[0].label}  ·  ${SITE.emailAdmin}`, M, 39, 7, reg, GREY);
  rt("Thank you for your business.", RIGHT, 50, 8, italic, GREY);

  return pdf.save();
}

// ── CLI ─────────────────────────────────────────────────────────────────────
async function main() {
  const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const cfgPath = arg("--config");
  const out = arg("--out") ?? "proforma.pdf";
  if (!cfgPath) { console.error("usage: --config <file.json> [--out <file.pdf>]"); process.exit(1); }
  const cfg = JSON.parse(await fs.readFile(cfgPath, "utf8")) as Config;
  await fs.writeFile(out, await buildProforma(cfg));
  const total = cfg.items.reduce((s, i) => s + i.qty * i.unitAED, 0);
  console.log(`✅ ${out} — ${cfg.number}, ${cfg.items.reduce((s, i) => s + i.qty, 0)} items, ${money(total)}`);
}

if (process.argv[1]?.endsWith("proforma.ts")) main();
