import "server-only";
import { signInvoiceToken, verifyInvoiceTokenWith } from "./invoice-token-core";

/**
 * Short, unguessable token for shareable invoice links (HMAC of the invoice no).
 * Lets a client open their own invoice without an ERP session, while keeping
 * other invoices private (you can't enumerate them without the secret).
 */
function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    // Fail closed — never sign with a missing/guessable secret (mirrors lib/auth.ts).
    throw new Error("AUTH_SECRET is missing or too short (need ≥ 32 chars).");
  }
  return s;
}

export function invoiceToken(invoiceNo: string): string {
  return signInvoiceToken(invoiceNo, secret());
}

export function verifyInvoiceToken(invoiceNo: string, token: string): boolean {
  return verifyInvoiceTokenWith(invoiceNo, token, secret());
}
