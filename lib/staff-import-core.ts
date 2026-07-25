// Pure, dependency-free helpers for importing staff HR/compliance details from a
// spreadsheet export (see scripts/import-staff-info.ts). Kept separate + unit-tested
// because the matching is safety-critical: a wrong match would write one person's
// passport onto another. Conservative by design — only unambiguous matches apply.

export type StaffLite = { id: string; name: string };

/** Trim a spreadsheet cell; treat "", "-", and "N/A" as empty (null). */
export function cleanCell(v: string | null | undefined): string | null {
  const s = (v ?? "").toString().trim();
  if (!s || s === "-" || /^n\/?a$/i.test(s)) return null;
  return s.replace(/\s+/g, " ");
}

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z]/g, "");
const tokens = (s: string) => (s || "").toLowerCase().split(/\s+/).map((t) => t.replace(/[^a-z]/g, "")).filter(Boolean);

/**
 * Resolve a spreadsheet name to exactly one staff record, or explain why not.
 * Rules (conservative on purpose):
 *  - exact normalized-name match wins;
 *  - otherwise every token of a multi-token name must appear in a single staff name;
 *  - single-token names, no match, or multiple matches are SKIPPED (never guessed).
 */
export function matchStaff(staff: StaffLite[], name: string): { id: string } | { skip: string } {
  const nm = norm(name), tk = tokens(name);
  const exact = staff.filter((s) => norm(s.name) === nm);
  if (exact.length === 1) return { id: exact[0].id };
  if (tk.length < 2) return { skip: "ambiguous (single-token name)" };
  const hits = staff.filter((s) => { const st = tokens(s.name); return tk.every((t) => st.includes(t)); });
  if (hits.length === 1) return { id: hits[0].id };
  if (hits.length === 0) return { skip: "no matching staff" };
  return { skip: `ambiguous (${hits.length} staff match)` };
}

/** Spreadsheet key -> Staff column. `contact` folds into the existing `phone`. */
export const FIELD_MAP: Record<string, string> = {
  contact: "phone",
  passportNumber: "passportNumber",
  passportExpiry: "passportExpiry",
  emiratesId: "emiratesId",
  emiratesIdExpiry: "emiratesIdExpiry",
  labourPermitNumber: "labourPermitNumber",
  labourCardNumber: "labourCardNumber",
  emergencyContact: "emergencyContact",
  emergencyRelationship: "emergencyRelationship",
  passportPicLink: "passportPicLink",
};

/** Build a Prisma update payload from a record — cleaned, non-empty cells only. */
export function buildStaffUpdate(rec: Record<string, unknown>, map: Record<string, string> = FIELD_MAP): Record<string, string> {
  const data: Record<string, string> = {};
  for (const [key, col] of Object.entries(map)) {
    const v = cleanCell(rec[key] as string);
    if (v) data[col] = v;
  }
  return data;
}
