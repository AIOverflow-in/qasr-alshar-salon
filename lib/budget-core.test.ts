import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBudgetSummary } from "./budget-core";

test("spent vs budget, remaining and % used", () => {
  const r = buildBudgetSummary({
    budgets: [{ category: "RENT", amountAED: 26000 }, { category: "FOOD", amountAED: 1000 }],
    spendByCategory: [{ category: "RENT", amountAED: 26000 }, { category: "FOOD", amountAED: 250 }],
    salariesAED: 0,
  });
  const rent = r.rows.find((x) => x.category === "RENT")!;
  assert.equal(rent.spentAED, 26000);
  assert.equal(rent.remainingAED, 0);
  assert.equal(rent.pctUsed, 100);
  assert.equal(rent.over, false); // exactly on budget is not over
  const food = r.rows.find((x) => x.category === "FOOD")!;
  assert.equal(food.pctUsed, 25);
  assert.equal(food.remainingAED, 750);
});

test("overspend is flagged and sorted to the top", () => {
  const r = buildBudgetSummary({
    budgets: [{ category: "FOOD", amountAED: 500 }, { category: "RENT", amountAED: 26000 }],
    spendByCategory: [{ category: "FOOD", amountAED: 900 }, { category: "RENT", amountAED: 1000 }],
    salariesAED: 0,
  });
  assert.equal(r.rows[0].category, "FOOD", "overspent row comes first");
  assert.equal(r.rows[0].over, true);
  assert.equal(r.rows[0].remainingAED, -400);
  assert.equal(r.overCount, 1);
});

test("salaries come from payroll, and a SALARIES expense row is ignored (no double count)", () => {
  const r = buildBudgetSummary({
    budgets: [{ category: "SALARIES", amountAED: 40000 }],
    spendByCategory: [{ category: "SALARIES", amountAED: 99999 }], // must be ignored
    salariesAED: 22670,
  });
  const sal = r.rows.find((x) => x.category === "SALARIES")!;
  assert.equal(sal.spentAED, 22670);
  assert.equal(sal.remainingAED, 40000 - 22670);
});

test("categories with spend but no budget still show (so nothing is hidden)", () => {
  const r = buildBudgetSummary({
    budgets: [],
    spendByCategory: [{ category: "SUPPLIES", amountAED: 400 }],
    salariesAED: 0,
  });
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].budgetAED, 0);
  assert.equal(r.rows[0].pctUsed, 0); // no divide-by-zero
  assert.equal(r.rows[0].over, false); // can't overspend a budget that doesn't exist
  assert.equal(r.anyBudgetSet, false);
});

test("empty state totals cleanly", () => {
  const r = buildBudgetSummary({ budgets: [], spendByCategory: [], salariesAED: 0 });
  assert.deepEqual(r.rows, []);
  assert.equal(r.totalBudget, 0);
  assert.equal(r.totalSpent, 0);
  assert.equal(r.overCount, 0);
});

test("labels are human-readable", () => {
  const r = buildBudgetSummary({
    budgets: [{ category: "CEO_ALLOWANCE", amountAED: 1000 }],
    spendByCategory: [], salariesAED: 0,
  });
  assert.equal(r.rows[0].label, "CEO allowance");
});
