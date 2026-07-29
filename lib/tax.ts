import "server-only";
import { SITE } from "./site";

/**
 * Central VAT presentation switch. The salon has Corporate Tax registration but VAT is still
 * pending, so until a VAT TRN is configured, receipts/invoices print as PLAIN sales documents
 * (no VAT breakdown, no "Tax Invoice" wording, no TRN). The moment `VAT_TRN` is set in the env,
 * every document flips to full Tax-Invoice mode with the 5% VAT split + the TRN — no code change.
 */
export const TAX = {
  /** True once the salon is VAT-registered (a VAT TRN is configured). */
  vatRegistered: !!process.env.VAT_TRN?.trim(),
  vatTRN: process.env.VAT_TRN?.trim() ?? "",
  vatPct: 5,
} as const;

/** Legal entity details for tax documents (from lib/site.ts). */
export const LEGAL = {
  name: SITE.legal.name,
  tradingName: SITE.legal.tradingName,
  ctTRN: SITE.legal.ctTRN,
  licenseNo: SITE.legal.licenseNo,
  address: SITE.legal.address,
} as const;

/** Title for a sales document: a VAT "Tax Invoice" only once registered, otherwise a plain receipt/invoice. */
export function docTitle(kind: "receipt" | "invoice"): string {
  if (TAX.vatRegistered) return "TAX INVOICE";
  return kind === "receipt" ? "RECEIPT" : "INVOICE";
}
