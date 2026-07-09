import { test } from "node:test";
import assert from "node:assert/strict";
import { expenseWhere, isExpenseCategory } from "./expense-filter.ts";

const start = new Date("2026-07-01T00:00:00Z");
const end = new Date("2026-08-01T00:00:00Z");

test("isExpenseCategory validates", () => {
  assert.ok(isExpenseCategory("RENT"));
  assert.ok(!isExpenseCategory("NOPE"));
  assert.ok(!isExpenseCategory(null));
});

test("manager: no createdBy scope, no SALARIES exclusion", () => {
  const w = expenseWhere({ isManager: true, userId: "u1", start, end });
  assert.deepEqual(w.incurredOn, { gte: start, lt: end });
  assert.equal(w.AND, undefined); // no extra constraints
});

test("manager can filter SALARIES", () => {
  const w = expenseWhere({ isManager: true, userId: "u1", start, end, category: "SALARIES" });
  assert.deepEqual(w.AND, [{ category: "SALARIES" }]);
});

test("reception: always scoped to own rows + never SALARIES", () => {
  const w = expenseWhere({ isManager: false, userId: "rec1", start, end });
  const and = w.AND as any[];
  assert.ok(and.some((c) => c.createdById === "rec1"), "scoped to createdById");
  assert.ok(and.some((c) => c.category && c.category.not === "SALARIES"), "excludes SALARIES");
});

test("reception picking SALARIES is ignored (still excluded, not narrowed to it)", () => {
  const w = expenseWhere({ isManager: false, userId: "rec1", start, end, category: "SALARIES" });
  const and = w.AND as any[];
  assert.ok(!and.some((c) => c.category === "SALARIES"), "never narrows to SALARIES for reception");
  assert.ok(and.some((c) => c.category && c.category.not === "SALARIES"));
});

test("category + q filters compose", () => {
  const w = expenseWhere({ isManager: true, userId: "u1", start, end, category: "SUPPLIES", q: "printer" });
  const and = w.AND as any[];
  assert.ok(and.some((c) => c.category === "SUPPLIES"));
  const orClause = and.find((c) => c.OR);
  assert.ok(orClause && orClause.OR.length === 2, "searches description + invoiceNo");
});
