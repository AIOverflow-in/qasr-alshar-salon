import crypto from "node:crypto";

/**
 * Pure HMAC token logic for shareable invoice links, with the secret passed in.
 *
 * Extracted from lib/invoice-token.ts (which is `server-only` and reads AUTH_SECRET from the env)
 * so the crypto is unit-testable with a fixed secret. lib/invoice-token.ts wraps these with the
 * real secret. The token is an HMAC-SHA256 of the invoice number, truncated to 24 hex chars — long
 * enough to be unguessable, short enough for a tidy URL.
 */
export function signInvoiceToken(invoiceNo: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(invoiceNo).digest("hex").slice(0, 24);
}

export function verifyInvoiceTokenWith(invoiceNo: string, token: string, secret: string): boolean {
  const expected = signInvoiceToken(invoiceNo, secret);
  if (token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}
