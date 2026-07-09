import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeNewStaff,
  DEFAULT_STAFF_ROLE,
  DEFAULT_COMMISSION_PCT,
  DEFAULT_REFERRAL_PCT,
} from "./staff-core.ts";

test("blank / whitespace name is rejected", () => {
  assert.throws(() => normalizeNewStaff({ name: "   " }), /Name is required/);
  assert.throws(() => normalizeNewStaff({}), /Name is required/);
});

test("applies schema defaults when pay fields are omitted", () => {
  const s = normalizeNewStaff({ name: "  Aya  " });
  assert.equal(s.name, "Aya");
  assert.equal(s.role, DEFAULT_STAFF_ROLE);
  assert.equal(s.salaryAED, 0);
  assert.equal(s.commissionPct, DEFAULT_COMMISSION_PCT);
  assert.equal(s.referralPct, DEFAULT_REFERRAL_PCT);
  assert.equal(s.phone, null);
  assert.equal(s.joinedOn, null);
});

test("trims text and keeps provided values", () => {
  const s = normalizeNewStaff({ name: "Brian", role: "  Hair Stylist ", phone: " +9715 ", salaryAED: 2700, commissionPct: 45, referralPct: 10 });
  assert.equal(s.role, "Hair Stylist");
  assert.equal(s.phone, "+9715");
  assert.equal(s.salaryAED, 2700);
  assert.equal(s.commissionPct, 45);
  assert.equal(s.referralPct, 10);
});

test("salary floored at 0, rounded; percentages clamped to 0–100", () => {
  const s = normalizeNewStaff({ name: "X", salaryAED: -500.7, commissionPct: 250, referralPct: -3 });
  assert.equal(s.salaryAED, 0);
  assert.equal(s.commissionPct, 100);
  assert.equal(s.referralPct, 0);
  assert.equal(normalizeNewStaff({ name: "X", salaryAED: 1999.6 }).salaryAED, 2000);
});

test("NaN / non-finite pay fields fall back to defaults, not NaN", () => {
  const s = normalizeNewStaff({ name: "X", salaryAED: NaN, commissionPct: Infinity, referralPct: NaN });
  assert.equal(s.salaryAED, 0);
  assert.equal(s.commissionPct, DEFAULT_COMMISSION_PCT);
  assert.equal(s.referralPct, DEFAULT_REFERRAL_PCT);
});

test("commission of 0 is respected (commission-only vs default)", () => {
  assert.equal(normalizeNewStaff({ name: "X", commissionPct: 0 }).commissionPct, 0);
});

test("joining date parses to a Date", () => {
  const s = normalizeNewStaff({ name: "X", joinedOn: "2026-01-15" });
  assert.ok(s.joinedOn instanceof Date);
  assert.equal(s.joinedOn?.toISOString().slice(0, 10), "2026-01-15");
});
