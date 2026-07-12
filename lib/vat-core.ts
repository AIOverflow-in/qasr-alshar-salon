// Pure VAT arithmetic for the VAT-INCLUSIVE pricing model — unit-tested in
// vat-core.test.ts. Service prices (and OrderLine.lineAED) are the GROSS,
// VAT-inclusive amount; VAT is computed *out of* the total, and any figure that
// must be net (ex-VAT) — e.g. the commission base — divides it back out.

export const VAT_PCT = 5;

/** VAT contained in a VAT-inclusive total: round(total − total / (1 + pct/100)). */
export function vatFromInclusive(total: number, pct: number = VAT_PCT): number {
  return Math.round(total - total / (1 + pct / 100));
}

/** Net (ex-VAT) portion of a VAT-inclusive total. */
export function netFromInclusive(total: number, pct: number = VAT_PCT): number {
  return total - vatFromInclusive(total, pct);
}

/** Add VAT to a NET price to get the gross (used once to migrate the menu to inclusive prices). */
export function grossFromNet(net: number, pct: number = VAT_PCT): number {
  return Math.round(net * (1 + pct / 100));
}
