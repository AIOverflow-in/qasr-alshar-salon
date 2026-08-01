import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMonthClose, monthsEndingAt, monthLabel, type BuildInput } from "./month-close-core";

const base: BuildInput = {
  month: "2026-08",
  isCurrent: true,
  monthOrders: [
    { createdAt: new Date("2026-08-03T09:00:00Z"), totalAED: 200, subtotalAED: 190, vatAED: 10 }, // wk1
    { createdAt: new Date("2026-08-10T09:00:00Z"), totalAED: 300, subtotalAED: 286, vatAED: 14 }, // wk2
    { createdAt: new Date("2026-08-25T09:00:00Z"), totalAED: 500, subtotalAED: 476, vatAED: 24 }, // wk4
  ],
  trendOrders: [
    { createdAt: new Date("2026-07-15T09:00:00Z"), totalAED: 400 },
    { createdAt: new Date("2026-08-03T09:00:00Z"), totalAED: 200 },
  ],
  trendMonths: ["2026-06", "2026-07", "2026-08"],
  payroll: { net: 600, paidNet: 400, outstandingNet: 200 },
  owedCount: 3,
  paidCount: 2,
  expenseGroups: [
    { category: "RENT", amountAED: 100 },
    { category: "SALARIES", amountAED: 999 }, // must be ignored (payroll is the source)
    { category: "SUPPLIES", amountAED: 50 },
  ],
};

test("sales totals + net profit (net sales − salaries − other expenses)", () => {
  const r = buildMonthClose(base);
  assert.equal(r.sales.grossAED, 1000);
  assert.equal(r.sales.netAED, 952);
  assert.equal(r.sales.orders, 3);
  assert.equal(r.otherExpensesAED, 150); // RENT + SUPPLIES, SALARIES excluded
  assert.equal(r.netProfitAED, 952 - 600 - 150); // 202
});

test("weekly buckets place orders in the right week", () => {
  const r = buildMonthClose(base);
  assert.equal(r.weekly.length, 5); // Aug 2026 = 31 days → 5 weeks
  assert.equal(r.weekly[0].grossAED, 200); // wk1 (3rd)
  assert.equal(r.weekly[1].grossAED, 300); // wk2 (10th)
  assert.equal(r.weekly[3].grossAED, 500); // wk4 (25th)
  assert.equal(r.weekly[2].grossAED, 0);
});

test("monthly trend follows trendMonths order and sums gross", () => {
  const r = buildMonthClose(base);
  assert.deepEqual(r.trend.map((t) => t.month), ["2026-06", "2026-07", "2026-08"]);
  assert.equal(r.trend[0].grossAED, 0);   // June: none
  assert.equal(r.trend[1].grossAED, 400); // July
  assert.equal(r.trend[2].grossAED, 200); // Aug
});

test("salaries carry paid/outstanding + counts; expense slices sorted, salaries included, zero dropped", () => {
  const r = buildMonthClose(base);
  assert.equal(r.salaries.netAED, 600);
  assert.equal(r.salaries.outstandingAED, 200);
  assert.equal(r.salaries.paidCount, 2);
  assert.equal(r.salaries.owedCount, 3);
  // slices: Salaries 600, Rent 100, Supplies 50 — largest first, SALARIES expense row ignored
  assert.deepEqual(r.expenseSlices.map((s) => s.amountAED), [600, 100, 50]);
  assert.equal(r.expenseSlices[0].kind, "salaries");
});

test("monthsEndingAt: 6 months ending Aug 2026, oldest→newest, handles year rollover", () => {
  assert.deepEqual(monthsEndingAt("2026-08", 6), ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]);
  assert.deepEqual(monthsEndingAt("2026-01", 3), ["2025-11", "2025-12", "2026-01"]);
});

test("monthLabel formats YYYY-MM", () => {
  assert.equal(monthLabel("2026-08"), "August 2026");
});
