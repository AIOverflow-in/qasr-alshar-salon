import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { aed } from "@/lib/utils";
import { monthStartUTC } from "@/lib/finance";
import { AddExpenseForm } from "@/components/erp/AddExpenseForm";
import { Pagination } from "@/components/erp/Pagination";
import { ReceiptPreview } from "@/components/erp/ReceiptPreview";
import { parsePage, pageWindow } from "@/lib/pagination-core";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "short", year: "numeric" }).format(d);
const cap = (c: string) => c[0] + c.slice(1).toLowerCase();

/**
 * Add-only expense screen — reachable by reception as well as managers. It only
 * logs and lists expenses; capital, payroll and profit figures live on /erp/finance
 * (managers/investor only), so reception never sees sensitive totals here.
 */
export default async function ErpExpenses({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const ok = await requireRole(["SUPER_ADMIN", "ADMIN", "RECEPTION"]);
  if (!ok) redirect("/erp");
  const isManager = ok.role === "SUPER_ADMIN" || ok.role === "ADMIN";

  // Reception is add-only: they see ONLY the expenses they themselves logged, and
  // never SALARIES rows — so manager-logged payroll/rent figures stay private.
  const where: Prisma.ExpenseWhereInput = isManager ? {} : { createdById: ok.sub, category: { not: "SALARIES" } };
  const total = await prisma.expense.count({ where });
  const win = pageWindow(total, parsePage((await searchParams).page));
  const [expenses, monthAgg] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: { incurredOn: "desc" }, skip: win.skip, take: win.take }),
    // "This month" summary — the same scoped `where`, narrowed to the current month.
    prisma.expense.aggregate({ _sum: { amountAED: true }, _count: true, where: { ...where, incurredOn: { gte: monthStartUTC() } } }),
  ]);
  const monthTotal = monthAgg._sum.amountAED ?? 0;
  const monthCount = monthAgg._count;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Expenses</h1>
        <p className="text-sm text-muted">Log a purchase with its date, amount, invoice number and a photo of the receipt.</p>
      </div>

      <div className="surface flex items-center justify-between gap-4 rounded-2xl p-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Logged this month</div>
          <div className="font-display text-3xl text-gold">{aed(monthTotal)}</div>
        </div>
        <div className="text-right text-sm text-muted">
          {monthCount} expense{monthCount === 1 ? "" : "s"}
          {!isManager && <div className="text-xs">by you</div>}
        </div>
      </div>

      <div className="surface rounded-2xl p-5">
        <AddExpenseForm />
      </div>

      <div className="surface rounded-2xl p-5">
        <h2 className="mb-2 font-display text-lg text-cream">{isManager ? "Recently logged" : "Expenses you've logged"}</h2>
        <div className="divide-y divide-ink-line/60">
          {expenses.length === 0 && <p className="py-6 text-center text-sm text-muted">No expenses logged yet.</p>}
          {expenses.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate text-cream">{e.description}</div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  <span>{cap(e.category)} · {fmtDate(e.incurredOn)}</span>
                  {e.invoiceNo && <span>· inv {e.invoiceNo}</span>}
                  {e.receiptUrl && (
                    <ReceiptPreview
                      url={e.receiptUrl}
                      title={e.description}
                      details={[
                        { label: "Description", value: e.description },
                        { label: "Category", value: cap(e.category) },
                        { label: "Date", value: fmtDate(e.incurredOn) },
                        { label: "Amount", value: aed(e.amountAED), strong: true },
                        ...(e.invoiceNo ? [{ label: "Invoice #", value: e.invoiceNo }] : []),
                      ]}
                    />
                  )}
                </div>
              </div>
              <span className="shrink-0 font-semibold text-sand">{aed(e.amountAED)}</span>
            </div>
          ))}
        </div>
      </div>

      <Pagination total={win.total} page={win.page} size={win.size} />
    </div>
  );
}
