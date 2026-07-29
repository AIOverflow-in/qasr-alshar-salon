import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProfitAndLoss, resolvePLRange, buildPLCsv, dubaiTodayISO, CT_PERIOD, type PLReport } from "./pl-core";

test("buildProfitAndLoss: not VAT-registered → income is gross, no VAT separated", () => {
  const r = buildProfitAndLoss({
    vatRegistered: false,
    serviceGrossAED: 10000, productGrossAED: 2000,
    expensesByCategory: [{ category: "RENT", amountAED: 5000 }, { category: "SALARIES", amountAED: 3000 }],
  });
  assert.equal(r.incomeBasis, "gross");
  assert.equal(r.totalIncome, 12000);
  assert.equal(r.vatCollected, 0);
  assert.equal(r.income[0].label, "Service revenue");
  assert.equal(r.income[0].amountAED, 10000);
  assert.equal(r.totalExpenses, 8000);
  assert.equal(r.netProfit, 4000);
  assert.equal(r.netMarginPct, 33.3); // 4000/12000
});

test("buildProfitAndLoss: VAT-registered → income net of VAT, VAT excluded and reported", () => {
  const r = buildProfitAndLoss({
    vatRegistered: true, vatPct: 5,
    serviceGrossAED: 10500, productGrossAED: 0,
    expensesByCategory: [{ category: "RENT", amountAED: 5000 }],
  });
  assert.equal(r.incomeBasis, "net");
  assert.equal(r.totalIncome, 10000); // 10500 net of 5% = 10000
  assert.equal(r.vatCollected, 500);
  assert.equal(r.netProfit, 5000);
  assert.match(r.basisNote, /net of 5% VAT/);
});

test("buildProfitAndLoss: expenses labelled, zero rows dropped, largest first", () => {
  const r = buildProfitAndLoss({
    vatRegistered: false, serviceGrossAED: 1000, productGrossAED: 0,
    expensesByCategory: [
      { category: "MARKETING", amountAED: 100 },
      { category: "RENT", amountAED: 900 },
      { category: "VISA", amountAED: 0 }, // dropped
      { category: "WEIRD", amountAED: 50 }, // unknown → passthrough label
    ],
  });
  assert.deepEqual(r.expenses.map((e) => e.label), ["Rent", "Marketing & advertising", "WEIRD"]);
  assert.equal(r.expenses.length, 3);
  assert.equal(r.totalExpenses, 1050);
});

test("buildProfitAndLoss: no income → margin is 0 (no divide-by-zero)", () => {
  const r = buildProfitAndLoss({ vatRegistered: false, serviceGrossAED: 0, productGrossAED: 0, expensesByCategory: [{ category: "RENT", amountAED: 500 }] });
  assert.equal(r.totalIncome, 0);
  assert.equal(r.netMarginPct, 0);
  assert.equal(r.netProfit, -500);
});

test("dubaiTodayISO uses Dubai calendar day (UTC+4)", () => {
  // 22:00 UTC on 28 Jul = 02:00 Dubai on 29 Jul
  assert.equal(dubaiTodayISO(new Date("2026-07-28T22:00:00Z")), "2026-07-29");
});

test("resolvePLRange: this month spans from the 1st (Dubai) to end of today", () => {
  const now = new Date("2026-07-15T09:00:00Z");
  const r = resolvePLRange({}, now);
  assert.equal(r.period, "month");
  assert.equal(r.from, "2026-07-01");
  assert.equal(r.to, "2026-07-15");
  assert.match(r.label, /July 2026/);
  // start is 1 Jul 00:00 Dubai = 30 Jun 20:00 UTC
  assert.equal(r.start.toISOString(), "2026-06-30T20:00:00.000Z");
});

test("resolvePLRange: last month handles January → December rollover", () => {
  const r = resolvePLRange({ period: "lastmonth" }, new Date("2026-01-10T09:00:00Z"));
  assert.equal(r.from, "2025-12-01");
  assert.equal(r.to, "2025-12-31");
  assert.match(r.label, /December 2025/);
});

test("resolvePLRange: CT tax period matches the certificate", () => {
  const r = resolvePLRange({ period: "ct" });
  assert.equal(r.from, CT_PERIOD.from);
  assert.equal(r.to, CT_PERIOD.to);
});

test("resolvePLRange: custom range, and reversed dates are normalised", () => {
  const a = resolvePLRange({ period: "custom", from: "2026-03-01", to: "2026-03-31" });
  assert.equal(a.from, "2026-03-01");
  assert.equal(a.to, "2026-03-31");
  const b = resolvePLRange({ period: "custom", from: "2026-03-31", to: "2026-03-01" });
  assert.equal(b.from, "2026-03-01"); // normalised
  assert.equal(b.to, "2026-03-31");
  // invalid custom falls back to this month
  const c = resolvePLRange({ period: "custom", from: "bad" }, new Date("2026-07-15T09:00:00Z"));
  assert.equal(c.period, "month");
});

test("buildPLCsv: has header, both sections, and net profit", () => {
  const r: PLReport = buildProfitAndLoss({
    vatRegistered: false, serviceGrossAED: 1000, productGrossAED: 0,
    expensesByCategory: [{ category: "RENT", amountAED: 300 }],
  });
  const csv = buildPLCsv(r, { label: "July 2026", from: "2026-07-01", to: "2026-07-31" });
  assert.match(csv, /Profit & Loss/);
  assert.match(csv, /Income,Service revenue,1000/);
  assert.match(csv, /Income,Total income,1000/);
  assert.match(csv, /Expenses,Rent,300/);
  assert.match(csv, /Result,Net profit,700/);
  assert.ok(csv.endsWith("\r\n"));
});
