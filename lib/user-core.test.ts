import { test } from "node:test";
import assert from "node:assert/strict";
import { stylistNeedsStaff } from "./user-core.ts";

test("a STYLIST login with no staff link is flagged (would show an empty calendar)", () => {
  assert.equal(stylistNeedsStaff("STYLIST", null), true);
  assert.equal(stylistNeedsStaff("STYLIST", undefined), true);
  assert.equal(stylistNeedsStaff("STYLIST", ""), true);
});

test("a linked STYLIST is fine", () => {
  assert.equal(stylistNeedsStaff("STYLIST", "staff_123"), false);
});

test("non-stylist roles never require a staff link", () => {
  for (const role of ["SUPER_ADMIN", "ADMIN", "RECEPTION", "INVESTOR"]) {
    assert.equal(stylistNeedsStaff(role, null), false);
    assert.equal(stylistNeedsStaff(role, "staff_123"), false);
  }
});
