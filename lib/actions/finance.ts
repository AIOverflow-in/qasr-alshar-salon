"use server";

import { revalidatePath } from "next/cache";
import { EXPENSE_CATEGORIES } from "@/lib/expense-filter";
import { del } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendDailyDigest } from "@/lib/digest";
import type { ExpenseCategory } from "@prisma/client";

/** Finance writes are owner/manager only — investors are read-only. */
async function requireFinanceWriter() {
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    throw new Error("Forbidden");
  }
  return session;
}

/** Logging an expense is allowed for reception too (add-only) — they never see capital/payroll/P&L. */
async function requireExpenseWriter() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "RECEPTION"].includes(session.role)) {
    throw new Error("Forbidden");
  }
  return session;
}

// Single source of truth — lib/expense-filter.ts. Keeps this in step with the schema enum.
const CATEGORIES = EXPENSE_CATEGORIES;

/** Owner/manager can send the daily takings digest on demand (to NOTIFY_EMAILS). */
export async function emailDailyDigestNow() {
  await requireFinanceWriter();
  return sendDailyDigest();
}

// Dubai is UTC+4 (no DST). Treat a bare date or a datetime-local input as Dubai
// local time so the stored instant matches what reception picked.
function toDubaiDate(s?: string | null): Date {
  if (!s) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00+04:00`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return new Date(`${s}:00+04:00`);
  return new Date(s);
}

export async function addExpense(data: {
  category: string;
  description: string;
  amountAED: number;
  incurredOn?: string | null;
  recurring?: boolean;
  notes?: string | null;
  invoiceNo?: string | null;
  receiptUrl?: string | null;
  receiptPath?: string | null;
  receiptUrls?: string[];
  receiptPaths?: string[];
}) {
  const session = await requireExpenseWriter();
  // Only managers may flag an expense as recurring (rent/salaries) — reception logs one-offs.
  const isManager = session.role === "SUPER_ADMIN" || session.role === "ADMIN";
  const category = (CATEGORIES.includes(data.category as ExpenseCategory) ? data.category : "OTHER") as ExpenseCategory;
  const amountAED = Math.max(0, Math.round(data.amountAED || 0));
  if (!data.description?.trim() || amountAED <= 0) throw new Error("Description and a positive amount are required.");
  // Accept multiple receipts (arrays); fall back to the legacy single fields.
  const arrUrls = (data.receiptUrls ?? []).map((u) => u.trim()).filter(Boolean);
  const allUrls = arrUrls.length ? arrUrls : (data.receiptUrl?.trim() ? [data.receiptUrl.trim()] : []);
  const allPaths = arrUrls.length ? (data.receiptPaths ?? []) : (data.receiptPath?.trim() ? [data.receiptPath.trim()] : []);
  await prisma.expense.create({
    data: {
      category,
      description: data.description.trim(),
      amountAED,
      incurredOn: toDubaiDate(data.incurredOn),
      recurring: isManager ? !!data.recurring : false,
      notes: data.notes?.trim() || null,
      invoiceNo: data.invoiceNo?.trim() || null,
      receiptUrl: allUrls[0] ?? null,   // legacy mirror = first receipt
      receiptPath: allPaths[0] ?? null,
      receiptUrls: allUrls,
      receiptPaths: allPaths,
      createdById: session.sub,
    },
  });
  revalidatePath("/erp/finance");
  revalidatePath("/erp/expenses");
}

/** Attach another receipt to an existing expense. */
export async function addExpenseReceipt(id: string, url: string, path: string) {
  await assertCanMutateExpense(id);
  const e = await prisma.expense.findUnique({ where: { id }, select: { receiptUrls: true, receiptPaths: true } });
  if (!e) throw new Error("Expense not found.");
  if (!url.trim()) throw new Error("Missing receipt.");
  const urls = [...e.receiptUrls, url.trim()];
  const paths = [...e.receiptPaths, path.trim()];
  await prisma.expense.update({ where: { id }, data: { receiptUrls: urls, receiptPaths: paths, receiptUrl: urls[0], receiptPath: paths[0] ?? null } });
  revalidatePath("/erp/finance");
  revalidatePath("/erp/expenses");
}

/** Remove one receipt from an expense (and best-effort delete its blob). */
export async function removeExpenseReceipt(id: string, url: string) {
  await assertCanMutateExpense(id);
  const e = await prisma.expense.findUnique({ where: { id }, select: { receiptUrls: true, receiptPaths: true } });
  if (!e) throw new Error("Expense not found.");
  const idx = e.receiptUrls.indexOf(url);
  if (idx < 0) return;
  const urls = e.receiptUrls.filter((_, i) => i !== idx);
  const paths = e.receiptPaths.filter((_, i) => i !== idx);
  await prisma.expense.update({ where: { id }, data: { receiptUrls: urls, receiptPaths: paths, receiptUrl: urls[0] ?? null, receiptPath: paths[0] ?? null } });
  if (e.receiptPaths[idx]) { try { await del(e.receiptPaths[idx]); } catch { /* blob may already be gone */ } }
  revalidatePath("/erp/finance");
  revalidatePath("/erp/expenses");
}

/** Managers may edit any expense; reception may edit only its OWN non-SALARIES entries. */
async function assertCanMutateExpense(id: string) {
  const session = await requireExpenseWriter();
  const isManager = session.role === "SUPER_ADMIN" || session.role === "ADMIN";
  const existing = await prisma.expense.findUnique({ where: { id }, select: { createdById: true, category: true } });
  if (!existing) throw new Error("Expense not found.");
  if (!isManager && (existing.createdById !== session.sub || existing.category === "SALARIES")) throw new Error("Forbidden");
  return { session, isManager };
}

export async function updateExpense(id: string, data: {
  category?: string;
  description?: string;
  amountAED?: number;
  incurredOn?: string | null;
  invoiceNo?: string | null;
  recurring?: boolean;
  receiptUrl?: string | null;
  receiptPath?: string | null;
}) {
  const { isManager } = await assertCanMutateExpense(id);
  const patch: Record<string, unknown> = {};
  if (data.category !== undefined) patch.category = (CATEGORIES.includes(data.category as ExpenseCategory) ? data.category : "OTHER");
  if (data.description !== undefined) {
    const d = data.description.trim();
    if (!d) throw new Error("Description is required.");
    patch.description = d;
  }
  if (data.amountAED !== undefined) {
    const amt = Math.max(0, Math.round(data.amountAED || 0));
    if (amt <= 0) throw new Error("A positive amount is required.");
    patch.amountAED = amt;
  }
  if (data.incurredOn !== undefined) patch.incurredOn = toDubaiDate(data.incurredOn);
  if (data.invoiceNo !== undefined) patch.invoiceNo = data.invoiceNo?.trim() || null;
  if (data.recurring !== undefined && isManager) patch.recurring = !!data.recurring;
  if (data.receiptUrl !== undefined) patch.receiptUrl = data.receiptUrl?.trim() || null;
  if (data.receiptPath !== undefined) patch.receiptPath = data.receiptPath?.trim() || null;
  await prisma.expense.update({ where: { id }, data: patch });
  revalidatePath("/erp/finance");
  revalidatePath("/erp/expenses");
}

export async function deleteExpense(id: string) {
  await assertCanMutateExpense(id);
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/erp/finance");
  revalidatePath("/erp/expenses");
}

export async function addCapital(data: { investor: string; amountAED: number; contributedOn?: string | null; notes?: string | null }) {
  await requireFinanceWriter();
  const amountAED = Math.max(0, Math.round(data.amountAED || 0));
  if (!data.investor?.trim() || amountAED <= 0) throw new Error("Investor and a positive amount are required.");
  await prisma.capitalEntry.create({
    data: {
      investor: data.investor.trim(),
      amountAED,
      contributedOn: data.contributedOn ? new Date(data.contributedOn) : new Date(),
      notes: data.notes?.trim() || null,
    },
  });
  revalidatePath("/erp/finance");
}

export async function deleteCapital(id: string) {
  await requireFinanceWriter();
  await prisma.capitalEntry.delete({ where: { id } });
  revalidatePath("/erp/finance");
}

// ---- scheduled / recurring payments (rent cheques, utilities, licence renewals) ----

export async function addScheduledPayment(data: {
  label: string;
  category: string;
  amountAED: number;
  dueDate: string;
  payee?: string | null;
  method?: string | null;
  reference?: string | null;
  remindDaysBefore?: number | null;
  notes?: string | null;
}) {
  await requireFinanceWriter();
  const category = (CATEGORIES.includes(data.category as ExpenseCategory) ? data.category : "OTHER") as ExpenseCategory;
  const amountAED = Math.max(0, Math.round(data.amountAED || 0));
  const due = data.dueDate ? new Date(data.dueDate) : null;
  if (!data.label?.trim() || amountAED <= 0 || !due || Number.isNaN(due.getTime())) {
    throw new Error("Label, a positive amount and a valid due date are required.");
  }
  const method = ["CHEQUE", "CASH", "TRANSFER"].includes(String(data.method)) ? String(data.method) : "CHEQUE";
  await prisma.scheduledPayment.create({
    data: {
      label: data.label.trim(),
      category,
      amountAED,
      dueDate: due,
      payee: data.payee?.trim() || null,
      method,
      reference: data.reference?.trim() || null,
      remindDaysBefore: Math.max(0, Math.min(90, Math.round(data.remindDaysBefore ?? 7))),
      notes: data.notes?.trim() || null,
    },
  });
  revalidatePath("/erp/finance");
}

export async function deleteScheduledPayment(id: string) {
  await requireFinanceWriter();
  // Remove the linked P&L expense too, if one was created when it was marked paid.
  const sp = await prisma.scheduledPayment.findUnique({ where: { id }, select: { expenseId: true } });
  await prisma.$transaction(async (tx) => {
    if (sp?.expenseId) await tx.expense.delete({ where: { id: sp.expenseId } }).catch(() => {});
    await tx.scheduledPayment.delete({ where: { id } });
  });
  revalidatePath("/erp/finance");
}

/** Mark a scheduled payment paid (logs a linked Expense → P&L) or revert it (removes that Expense). */
export async function setScheduledPaymentPaid(id: string, paid: boolean) {
  await requireFinanceWriter();
  const sp = await prisma.scheduledPayment.findUnique({ where: { id } });
  if (!sp) throw new Error("Payment not found.");

  await prisma.$transaction(async (tx) => {
    if (paid) {
      let expenseId = sp.expenseId;
      if (!expenseId) {
        const exp = await tx.expense.create({
          data: {
            category: sp.category,
            description: sp.label,
            amountAED: sp.amountAED,
            incurredOn: new Date(),
            recurring: true,
            notes: [sp.payee ? `Payee: ${sp.payee}` : null, sp.reference ? `Ref: ${sp.reference}` : null].filter(Boolean).join(" · ") || null,
          },
        });
        expenseId = exp.id;
      }
      await tx.scheduledPayment.update({ where: { id }, data: { status: "PAID", paidAt: new Date(), expenseId } });
    } else {
      if (sp.expenseId) await tx.expense.delete({ where: { id: sp.expenseId } }).catch(() => {});
      await tx.scheduledPayment.update({ where: { id }, data: { status: "PENDING", paidAt: null, expenseId: null } });
    }
  });
  revalidatePath("/erp/finance");
}

/**
 * Set (or clear) the monthly budget for an expense category. Amount 0 removes the budget.
 * Managers only — budgets are owner-level financial planning, not day-to-day expense logging.
 */
export async function setCategoryBudget(category: string, amountAED: number, note?: string | null) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.role)) throw new Error("Not allowed");
  if (!CATEGORIES.includes(category as ExpenseCategory)) throw new Error("Unknown category");
  const amt = Math.max(0, Math.round(amountAED || 0));
  const cat = category as ExpenseCategory;

  if (amt === 0) {
    await prisma.categoryBudget.deleteMany({ where: { category: cat } });
  } else {
    await prisma.categoryBudget.upsert({
      where: { category: cat },
      create: { category: cat, amountAED: amt, note: note?.trim() || null },
      update: { amountAED: amt, note: note?.trim() || null },
    });
  }
  revalidatePath("/erp/finance");
  revalidatePath("/erp");
}
