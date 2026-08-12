/**
 * Pure budget-vs-actual assembly for the Finance budgeting panel.
 *
 * Salaries are deliberately included as a budget line even though they never live in the Expense
 * table — the owner budgets a wage bill like any other cost, and leaving it out was exactly the
 * mistake that made the P&L overstate profit (see lib/pl-core.ts).
 */
import { EXPENSE_LABELS } from "./pl-core";

export const SALARIES_KEY = "SALARIES";

export type BudgetRow = {
  category: string;
  label: string;
  budgetAED: number;   // 0 = no budget set
  spentAED: number;
  remainingAED: number; // negative = overspent
  pctUsed: number;      // 0 when no budget is set
  over: boolean;
};

export type BudgetSummary = {
  rows: BudgetRow[];
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  overCount: number;
  anyBudgetSet: boolean;
};

export type BudgetInput = {
  budgets: { category: string; amountAED: number }[];
  /** Actual spend this month, by category (excluding SALARIES — that comes from payroll). */
  spendByCategory: { category: string; amountAED: number }[];
  /** Payroll net for the month, shown against the SALARIES budget. */
  salariesAED: number;
};

export function buildBudgetSummary(i: BudgetInput): BudgetSummary {
  const budget = new Map(i.budgets.map((b) => [b.category, b.amountAED]));
  const spent = new Map<string, number>();
  for (const s of i.spendByCategory) {
    if (s.category === SALARIES_KEY) continue; // payroll is the source of truth for wages
    spent.set(s.category, (spent.get(s.category) ?? 0) + s.amountAED);
  }
  if (i.salariesAED) spent.set(SALARIES_KEY, i.salariesAED);

  // Show every category that has either a budget or actual spend — never a wall of empty rows.
  const keys = [...new Set([...budget.keys(), ...spent.keys()])];

  const rows: BudgetRow[] = keys
    .map((category) => {
      const budgetAED = budget.get(category) ?? 0;
      const spentAED = spent.get(category) ?? 0;
      const remainingAED = budgetAED - spentAED;
      return {
        category,
        label: EXPENSE_LABELS[category] ?? category,
        budgetAED,
        spentAED,
        remainingAED,
        pctUsed: budgetAED > 0 ? Math.round((spentAED / budgetAED) * 100) : 0,
        over: budgetAED > 0 && spentAED > budgetAED,
      };
    })
    .filter((r) => r.budgetAED > 0 || r.spentAED > 0)
    // Overspent first (that's what needs attention), then by size.
    .sort((a, b) => Number(b.over) - Number(a.over) || b.spentAED - a.spentAED);

  const totalBudget = rows.reduce((s, r) => s + r.budgetAED, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spentAED, 0);

  return {
    rows,
    totalBudget,
    totalSpent,
    totalRemaining: totalBudget - totalSpent,
    overCount: rows.filter((r) => r.over).length,
    anyBudgetSet: totalBudget > 0,
  };
}
