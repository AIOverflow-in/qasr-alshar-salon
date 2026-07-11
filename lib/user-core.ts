// Pure invariant for crown-artist logins — unit-tested in user-core.test.ts.
// A STYLIST login MUST be linked to a Staff record (AdminUser.staffId); the
// calendar fails closed for an unlinked stylist, so an unlinked artist sees an
// empty schedule. Enforcing this at create + role-change time (plus a guardrail
// on the Users page) is the permanent, regression-free fix.

/** True when a login would be an unlinked crown artist (role STYLIST with no staff link). */
export function stylistNeedsStaff(role: string, staffId?: string | null): boolean {
  return role === "STYLIST" && !staffId;
}

export const UNLINKED_STYLIST_ERROR =
  "Pick the staff record this crown-artist login belongs to — otherwise their calendar shows nothing.";
