import "server-only";
import crypto from "node:crypto";

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
  return crypto.createHmac("sha256", secret()).update(invoiceNo).digest("hex").slice(0, 24);
}

export function verifyInvoiceToken(invoiceNo: string, token: string): boolean {
  const expected = invoiceToken(invoiceNo);
  if (token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}
