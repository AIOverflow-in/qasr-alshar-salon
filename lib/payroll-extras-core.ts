/**
 * Pure helpers for the two payroll additions agreed in the 11 Aug meeting: unpaid leave and
 * staff loans. Kept out of payroll-core.ts so the net-pay formula there stays untouched.
 *
 * Nothing here changes pay by itself — it produces SUGGESTIONS the manager applies with one click,
 * which become ordinary DEDUCTION adjustments. Payroll math must never move silently under her.
 */

/** UAE practice: a month's salary covers 30 days, so one unpaid day costs salary / 30. */
export const DAYS_IN_SALARY_MONTH = 30;

/** What an unpaid-leave day costs. Returns 0 when there's no base salary (commission-only staff). */
export function unpaidLeaveDeduction(salaryAED: number, unpaidDays: number): number {
  if (salaryAED <= 0 || unpaidDays <= 0) return 0;
  const capped = Math.min(unpaidDays, DAYS_IN_SALARY_MONTH); // a full month off can't cost more than the salary
  return Math.round((salaryAED / DAYS_IN_SALARY_MONTH) * capped);
}

export type LeaveRow = { type: string; days: number };

/** Unpaid days only — annual and sick leave are paid and must never be deducted. */
export function unpaidDaysOf(leaves: LeaveRow[]): number {
  return leaves
    .filter((l) => l.type.toUpperCase() === "UNPAID")
    .reduce((sum, l) => sum + Math.max(0, l.days), 0);
}

export type Loan = { amountAED: number; repaidAED: number };

/** What's still owed on a loan; never negative even if over-repaid. */
export function loanOutstanding(loan: Loan): number {
  return Math.max(0, Math.round(loan.amountAED - loan.repaidAED));
}

/** Total still owed across a staff member's loans. */
export function totalOutstanding(loans: Loan[]): number {
  return loans.reduce((sum, l) => sum + loanOutstanding(l), 0);
}

/**
 * A repayment can never exceed what's still owed, nor what the person is actually being paid —
 * deducting more than the net pay would hand someone a negative payslip.
 */
export function cappedRepayment(requested: number, outstanding: number, netPayAED: number): number {
  const wanted = Math.max(0, Math.round(requested));
  return Math.max(0, Math.min(wanted, outstanding, Math.max(0, netPayAED)));
}
