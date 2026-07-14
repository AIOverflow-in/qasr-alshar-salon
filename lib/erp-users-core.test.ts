import { test } from "node:test";
import assert from "node:assert/strict";
import { userDeletionGuard } from "./erp-users-core.ts";

const base = { isSelf: false, isLastSuperAdmin: false, createdOrders: 0 };

test("a plain login with no history can be deleted", () => {
  assert.deepEqual(userDeletionGuard(base), { ok: true });
});

test("you can never delete your own account", () => {
  const r = userDeletionGuard({ ...base, isSelf: true });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /your own account/i);
});

test("the last Super Admin is protected", () => {
  const r = userDeletionGuard({ ...base, isLastSuperAdmin: true });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /only Super Admin/i);
});

test("a login that created bills is kept (deactivate instead), with correct pluralisation", () => {
  const one = userDeletionGuard({ ...base, createdOrders: 1 });
  assert.equal(one.ok, false);
  if (!one.ok) assert.match(one.error, /created 1 bill\b/);
  const many = userDeletionGuard({ ...base, createdOrders: 5 });
  if (!many.ok) assert.match(many.error, /created 5 bills\b/);
});

test("self-check takes precedence over other reasons", () => {
  const r = userDeletionGuard({ isSelf: true, isLastSuperAdmin: true, createdOrders: 9 });
  if (!r.ok) assert.match(r.error, /your own account/i);
});
