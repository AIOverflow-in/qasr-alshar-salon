// Shared CSV cell encoder for every ERP export (sales, expenses, inventory,
// payroll). Two jobs:
//   1. RFC-4180 quoting — wrap the field and double up quotes when it contains
//      a comma, double-quote, or newline.
//   2. Formula-injection ("CSV injection") neutralization — a spreadsheet treats
//      a cell beginning with = + - @ (or tab/CR) as a formula. A value such as
//      =HYPERLINK(...) or a DDE payload, seeded from a PUBLIC booking name that
//      later lands in the Sales CSV, would execute when the owner opens the file.
//      We prefix such TEXT cells with a leading apostrophe to defuse them.
//
// Numbers are our OWN generated values (totals, amounts) and can never be a
// formula, so numeric cells pass through untouched — this deliberately keeps
// negative numbers like -500 intact instead of turning them into '-500.

const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function csvCell(v: string | number | null | undefined): string {
  if (typeof v === "number") return String(v); // our own number — never a formula, keep sign
  const raw = v == null ? "" : String(v);
  const safe = FORMULA_LEAD.test(raw) ? `'${raw}` : raw;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Excel on Windows assumes the system codepage, not UTF-8, unless the file opens with a byte-order
 * mark. Without it, a name like "Jonté" or any Arabic text arrives as mojibake in the salon's own
 * spreadsheets. Every export goes through here so they all behave the same.
 *
 * Safe for the inventory round-trip: the importer lowercases and trim()s each header, and JS treats
 * U+FEFF as whitespace, so a re-uploaded file still matches its columns.
 */
export function csvFile(headerAndRows: string[]): string {
  return "\uFEFF" + headerAndRows.join("\n");
}
