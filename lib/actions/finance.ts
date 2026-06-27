"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ExpenseCategory } from "@prisma/client";

/** Finance writes are owner/manager only — investors are read-only. */
async function requireFinanceWriter() {
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    throw new Error("Forbidden");
  }
  return session;
}

const CATEGORIES = ["RENT", "UTILITIES", "SALARIES", "VISA", "SUPPLIES", "MARKETING", "MAINTENANCE", "OTHER"] as const;

export async function addExpense(data: {
  category: string;
  description: string;
  amountAED: number;
  incurredOn?: string | null;
  recurring?: boolean;
  notes?: string | null;
}) {
  await requireFinanceWriter();
  const category = (CATEGORIES.includes(data.category as ExpenseCategory) ? data.category : "OTHER") as ExpenseCategory;
  const amountAED = Math.max(0, Math.round(data.amountAED || 0));
  if (!data.description?.trim() || amountAED <= 0) throw new Error("Description and a positive amount are required.");
  await prisma.expense.create({
    data: {
      category,
      description: data.description.trim(),
      amountAED,
      incurredOn: data.incurredOn ? new Date(data.incurredOn) : new Date(),
      recurring: !!data.recurring,
      notes: data.notes?.trim() || null,
    },
  });
  revalidatePath("/erp/finance");
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
