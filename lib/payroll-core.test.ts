import { test } from "node:test";
import assert from "node:assert/strict";
import { currentDubaiMonth, dubaiMonthRange, recentMonths, netPay } from "./payroll-core";

test("currentDubaiMonth is a YYYY-MM string", () => {
  assert.match(currentDubaiMonth(), /^\d{4}-\d{2}$/);
});

test("dubaiMonthRange returns Dubai-midnight UTC bounds", () => {
  // Dubai is UTC+4: the 1st at 00:00 Dubai = the previous day at 20:00 UTC.
  const { start, end } = dubaiMonthRange("2026-07");
  assert.equal(start.toISOString(), "2026-06-30T20:00:00.000Z");
  assert.equal(end.toISOString(), "2026-07-31T20:00:00.000Z");
  assert.equal((end.getTime() - start.getTime()) / 86_400_000, 31); // July has 31 days
});

test("dubaiMonthRange handles February length", () => {
  const { start, end } = dubaiMonthRange("2026-02");
  assert.equal(start.toISOString(), "2026-01-31T20:00:00.000Z");
  assert.equal((end.getTime() - start.getTime()) / 86_400_000, 28); // Feb 2026
});

test("recentMonths: newest first, well-formed, strictly descending", () => {
  const ms = recentMonths(6);
  assert.equal(ms.length, 6);
  assert.equal(ms[0], currentDubaiMonth());
  for (const m of ms) assert.match(m, /^\d{4}-\d{2}$/);
  for (let i = 1; i < ms.length; i++) assert.ok(ms[i] < ms[i - 1], `${ms[i]} < ${ms[i - 1]}`);
  assert.equal(new Set(ms).size, ms.length); // all distinct
});

test("netPay: base salary is a floor, referral always adds on top", () => {
  // Commission beats base → commission wins.
  assert.equal(netPay({ salesCommission: 5000, salary: 3000, referral: 0, bonus: 0, deductions: 0 }), 5000);
  // Commission below base → base floor applies.
  assert.equal(netPay({ salesCommission: 1000, salary: 3000, referral: 0, bonus: 0, deductions: 0 }), 3000);
  // Referral added whether commission or base wins.
  assert.equal(netPay({ salesCommission: 5000, salary: 3000, referral: 500, bonus: 0, deductions: 0 }), 5500);
  assert.equal(netPay({ salesCommission: 1000, salary: 3000, referral: 500, bonus: 0, deductions: 0 }), 3500);
});

test("netPay: bonus adds, advances/deductions subtract", () => {
  assert.equal(netPay({ salesCommission: 4000, salary: 3000, referral: 300, bonus: 100, deductions: 200 }), 4200);
  assert.equal(netPay({ salesCommission: 5000, salary: 3000, referral: 0, bonus: 0, deductions: 700 }), 4300);
});
