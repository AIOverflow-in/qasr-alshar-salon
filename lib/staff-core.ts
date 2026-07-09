// Pure validation + normalization for creating a staff member (name, role, pay
// config). No DB/server imports so it can be unit-tested in isolation. The
// createStaff server action calls this, then persists the result.

export const DEFAULT_STAFF_ROLE = "Crown Artist";
export const DEFAULT_COMMISSION_PCT = 40; // matches Staff.commissionPct schema default
export const DEFAULT_REFERRAL_PCT = 5; //    matches Staff.referralPct schema default

export type NewStaffInput = {
  name?: string;
  role?: string;
  phone?: string | null;
  salaryAED?: number;
  commissionPct?: number;
  referralPct?: number;
  joinedOn?: string | null; // yyyy-mm-dd
};

export type NewStaffClean = {
  name: string;
  role: string;
  phone: string | null;
  salaryAED: number;
  commissionPct: number;
  referralPct: number;
  joinedOn: Date | null;
};

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const num = (v: number | undefined) => (v != null && Number.isFinite(v) ? v : undefined);

/**
 * Validate + normalize a new-staff form: trims text, applies schema defaults for
 * omitted pay fields, clamps salary to ≥0 and percentages to 0–100, and parses
 * the optional joining date. Throws Error("Name is required.") on a blank name.
 */
export function normalizeNewStaff(input: NewStaffInput): NewStaffClean {
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("Name is required.");

  const salary = num(input.salaryAED);
  const comm = num(input.commissionPct);
  const ref = num(input.referralPct);
  const joined = input.joinedOn?.trim();

  return {
    name,
    role: input.role?.trim() || DEFAULT_STAFF_ROLE,
    phone: input.phone?.trim() ? input.phone.trim() : null,
    salaryAED: salary != null ? Math.max(0, Math.round(salary)) : 0,
    commissionPct: comm != null ? clampPct(comm) : DEFAULT_COMMISSION_PCT,
    referralPct: ref != null ? clampPct(ref) : DEFAULT_REFERRAL_PCT,
    joinedOn: joined ? new Date(joined) : null,
  };
}
