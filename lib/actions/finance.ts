"use server";

import { revalidatePath } from "next/cache";
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

const CATEGORIES = ["RENT", "UTILITIES", "SALARIES", "VISA", "SUPPLIES", "MARKETING", "MAINTENANCE", "OTHER"] as const;

/** Owner/manager can send the daily takings digest on demand (to NOTIFY_EMAILS). */
export async function emailDailyDigestNow() {
  await requireFinanceWriter();
  return sendDailyDigest();
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
}) {
  const session = await requireExpenseWriter();
  // Only managers may flag an expense as recurring (rent/salaries) — reception logs one-offs.
  const isManager = session.role === "SUPER_ADMIN" || session.role === "ADMIN";
  const category = (CATEGORIES.includes(data.category as ExpenseCategory) ? data.category : "OTHER") as ExpenseCategory;
  const amountAED = Math.max(0, Math.round(data.amountAED || 0));
  if (!data.description?.trim() || amountAED <= 0) throw new Error("Description and a positive amount are required.");
  await prisma.expense.create({
    data: {
      category,
      description: data.description.trim(),
      amountAED,
      incurredOn: data.incurredOn ? new Date(data.incurredOn) : new Date(),
      recurring: isManager ? !!data.recurring : false,
      notes: data.notes?.trim() || null,
      invoiceNo: data.invoiceNo?.trim() || null,
      receiptUrl: data.receiptUrl?.trim() || null,
      receiptPath: data.receiptPath?.trim() || null,
      createdById: session.sub,
    },
  });
  revalidatePath("/erp/finance");
  revalidatePath("/erp/expenses");
}

export async function deleteExpense(id: string) {
  await requireFinanceWriter();
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/erp/finance");
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
