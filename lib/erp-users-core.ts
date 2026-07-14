// Pure, dependency-free rules for user management — unit-tested in
// erp-users-core.test.ts. Keeps the "can I delete this login?" decision testable
// and separate from the server action that gathers the facts from the DB.

export type DeletionFacts = {
  /** Deleting your own account is never allowed (you'd lock yourself out). */
  isSelf: boolean;
  /** Target is the only remaining Super Admin — deleting it would lock everyone out. */
  isLastSuperAdmin: boolean;
  /** Bills/sales this login created — part of the audit trail, so keep (deactivate) instead. */
  createdOrders: number;
};

export type GuardResult = { ok: true } | { ok: false; error: string };

/** Decide whether a login may be hard-deleted. Enterprise-safe defaults: protect self,
 *  the last Super Admin, and any login tied to financial records. */
export function userDeletionGuard(f: DeletionFacts): GuardResult {
  if (f.isSelf) return { ok: false, error: "You can't delete your own account." };
  if (f.isLastSuperAdmin) return { ok: false, error: "You can't delete the only Super Admin." };
  if (f.createdOrders > 0) {
    return { ok: false, error: `This login created ${f.createdOrders} bill${f.createdOrders === 1 ? "" : "s"} — deactivate it instead so the records stay intact.` };
  }
  return { ok: true };
}
