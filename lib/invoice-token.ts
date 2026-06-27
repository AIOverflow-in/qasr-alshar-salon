import "server-only";
import crypto from "node:crypto";

/**
 * Short, unguessable token for shareable invoice links (HMAC of the invoice no).
 * Lets a client open their own invoice without an ERP session, while keeping
 * other invoices private (you can't enumerate them without the secret).
 */
export function invoiceToken(invoiceNo: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return crypto.createHmac("sha256", secret).update(invoiceNo).digest("hex").slice(0, 24);
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
