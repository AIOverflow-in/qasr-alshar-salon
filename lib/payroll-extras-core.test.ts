import { test } from "node:test";
import assert from "node:assert/strict";
import { unpaidLeaveDeduction, unpaidDaysOf, loanOutstanding, totalOutstanding, cappedRepayment } from "./payroll-extras-core";

test("unpaid leave costs salary/30 per day", () => {
  assert.equal(unpaidLeaveDeduction(3000, 10), 1000);  // Grace: 10 days off a 3,000 salary
  assert.equal(unpaidLeaveDeduction(1800, 20), 1200);
  assert.equal(unpaidLeaveDeduction(2000, 1), 67);     // rounded
});

test("no salary or no days = no deduction (commission-only staff are unaffected)", () => {
  assert.equal(unpaidLeaveDeduction(0, 10), 0);
  assert.equal(unpaidLeaveDeduction(3000, 0), 0);
  assert.equal(unpaidLeaveDeduction(3000, -5), 0);
});

test("a full month off never costs more than the salary", () => {
  assert.equal(unpaidLeaveDeduction(3000, 31), 3000);
  assert.equal(unpaidLeaveDeduction(3000, 90), 3000);
});

test("only UNPAID leave counts — annual and sick are paid", () => {
  assert.equal(unpaidDaysOf([{ type: "UNPAID", days: 10 }, { type: "ANNUAL", days: 5 }, { type: "SICK", days: 3 }]), 10);
  assert.equal(unpaidDaysOf([{ type: "unpaid", days: 4 }]), 4); // case-insensitive
  assert.equal(unpaidDaysOf([{ type: "ANNUAL", days: 12 }]), 0);
});

test("loan outstanding, and never negative when over-repaid", () => {
  assert.equal(loanOutstanding({ amountAED: 3000, repaidAED: 1000 }), 2000);
  assert.equal(loanOutstanding({ amountAED: 3000, repaidAED: 3500 }), 0);
  assert.equal(totalOutstanding([{ amountAED: 3000, repaidAED: 1000 }, { amountAED: 500, repaidAED: 0 }]), 2500);
});

test("a repayment can't exceed the balance or the net pay", () => {
  assert.equal(cappedRepayment(1000, 2000, 5000), 1000); // normal
  assert.equal(cappedRepayment(5000, 2000, 5000), 2000); // capped by the balance
  assert.equal(cappedRepayment(1000, 2000, 600), 600);   // capped by the pay — never a negative payslip
  assert.equal(cappedRepayment(1000, 2000, 0), 0);
  assert.equal(cappedRepayment(-50, 2000, 5000), 0);
});
