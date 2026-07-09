import type { Prisma } from "@prisma/client";

export const EXPENSE_CATEGORIES = ["RENT", "UTILITIES", "SALARIES", "VISA", "SUPPLIES", "MARKETING", "MAINTENANCE", "OTHER"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * Categories shown in the reception Expenses tab — kept to the bare minimum for
 * day-to-day items. The full set (rent, utilities, salaries, …) lives in the
 * Finance tab, which is owner-only. Both write to the same ExpenseCategory enum.
 */
export const EXPENSE_TAB_CATEGORIES = ["MAINTENANCE", "SUPPLIES", "OTHER"] as const;

export function isExpenseCategory(c: string | null | undefined): c is ExpenseCategory {
  return !!c && (EXPENSE_CATEGORIES as readonly string[]).includes(c);
}

/**
 * Single source of truth for the Expenses screen's `where` — used by both the
 * page and the CSV export so the RECEPTION privacy rules can never drift:
 * reception only ever sees rows they created and NEVER a SALARIES row, whatever
 * the category filter says. Managers see everything.
 *
 * `category`/`q` are the optional list filters; pass them null for the month-wide
 * scope used by the per-category breakdown.
 */
export function expenseWhere(opts: {
  isManager: boolean;
  userId: string;
  start: Date;
  end: Date;
  category?: string | null;
  q?: string | null;
}): Prisma.ExpenseWhereInput {
  const cat = isExpenseCategory(opts.category ?? null) ? (opts.category as ExpenseCategory) : null;
  const term = (opts.q ?? "").trim();
  const and: Prisma.ExpenseWhereInput[] = [];

  if (!opts.isManager) {
    and.push({ createdById: opts.userId });
    and.push({ category: { not: "SALARIES" } }); // reception never sees payroll rows
  }
  // Category filter — managers may pick any; reception may not narrow to SALARIES.
  if (cat && (opts.isManager || cat !== "SALARIES")) and.push({ category: cat });
  if (term) and.push({ OR: [
    { description: { contains: term, mode: "insensitive" } },
    { invoiceNo: { contains: term, mode: "insensitive" } },
  ] });

  return { incurredOn: { gte: opts.start, lt: opts.end }, ...(and.length ? { AND: and } : {}) };
}
