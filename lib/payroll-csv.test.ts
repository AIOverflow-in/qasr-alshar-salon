import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Jacqueline spotted that Sarah Gatibaro's commission was not 40% of her services and reported it
 * as a calculation bug. The calculation was right; the SHEET was unreadable. Her commissionPct had
 * been set to 0, so services kept growing while commission stayed frozen, and nothing in the export
 * said why. These pin the columns that make that visible.
 */
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const csv = read("../app/api/erp/payroll/export/route.ts");

test("the payroll CSV shows each artist's commission rate", () => {
  assert.ok(csv.includes('"Commission %"'), "a 0% artist is indistinguishable from a broken sum without this column");
  assert.ok(/r\.commissionPct/.test(csv), "the rate must come from the row, not be assumed to be 40");
});

test("the CSV says services are ex-VAT", () => {
  assert.ok(csv.includes("Services AED (ex-VAT)"),
    "commission is 40% of the ex-VAT value; unlabelled, the ratio reads as ~38% and looks wrong");
});

test("the TOTAL row totals the commission columns", () => {
  const total = csv.match(/rows\.push\(\["TOTAL".*?\)\);/s)![0];
  assert.ok(total.includes("t.salesCommission"), "the sales commission total was blank in the shipped sheet");
  assert.ok(total.includes("t.referral"), "the referral total was blank in the shipped sheet");
});

test("each row states which side of the floor paid them", () => {
  assert.ok(/const basis = r\.salesCommission > r\.salary/.test(csv),
    "salary is a floor: without this, a salaried artist looks underpaid on commission");
});

test("payroll exposes commissionPct so the export cannot guess it", () => {
  const pay = read("./payroll.ts");
  assert.ok(/commissionPct: number;/.test(pay), "PayrollRow must carry the rate");
  assert.ok(/commissionPct: true/.test(pay), "and it must actually be selected from the database");
});
