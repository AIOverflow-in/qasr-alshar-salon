import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { aed } from "@/lib/utils";
import { dubaiMonthRange, currentDubaiMonth, recentMonths } from "@/lib/payroll";
import { expenseWhere, EXPENSE_TAB_CATEGORIES, EXPENSE_CATEGORIES, isExpenseCategory } from "@/lib/expense-filter";
import { AddExpenseForm } from "@/components/erp/AddExpenseForm";
import { Pagination } from "@/components/erp/Pagination";
import { ReceiptPreview } from "@/components/erp/ReceiptPreview";
import { ExpenseActions } from "@/components/erp/ExpenseActions";
import { MonthPicker } from "@/components/erp/MonthPicker";
import { SearchBox } from "@/components/erp/SearchBox";
import { parsePage, pageWindow } from "@/lib/pagination-core";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "short", year: "numeric" }).format(d);
const cap = (c: string) => c[0] + c.slice(1).toLowerCase();
const monthLabel = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
};

/**
 * Add-only expense screen — reachable by reception as well as managers. It only
 * logs and lists expenses; capital, payroll and profit figures live on /erp/finance
 * (managers/investor only), so reception never sees sensitive totals here.
 */
export default async function ErpExpenses({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; month?: string; category?: string; q?: string }>;
}) {
  const ok = await requireRole(["SUPER_ADMIN", "ADMIN", "RECEPTION"]);
  if (!ok) redirect("/erp");
  const isManager = ok.role === "SUPER_ADMIN" || ok.role === "ADMIN";

  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentDubaiMonth();
  const { start, end } = dubaiMonthRange(month);
  const q = (sp.q ?? "").trim();
  const selectedCategory = isExpenseCategory(sp.category ?? null) ? sp.category! : "ALL";

  // Shared filter builder keeps the reception privacy scope identical here + in the CSV export.
  const listWhere = expenseWhere({ isManager, userId: ok.sub, start, end, category: selectedCategory === "ALL" ? null : selectedCategory, q });
  const scopeWhere = expenseWhere({ isManager, userId: ok.sub, start, end }); // month-wide, for the breakdown

  const filteredAgg = await prisma.expense.aggregate({ _sum: { amountAED: true }, _count: true, where: listWhere });
  const win = pageWindow(filteredAgg._count, parsePage(sp.page));
  const [expenses, breakdown] = await Promise.all([
    prisma.expense.findMany({ where: listWhere, orderBy: { incurredOn: "desc" }, skip: win.skip, take: win.take }),
    prisma.expense.groupBy({ by: ["category"], _sum: { amountAED: true }, where: scopeWhere }),
  ]);
  const filteredTotal = filteredAgg._sum.amountAED ?? 0;
  const sums = new Map(breakdown.map((b) => [b.category, b._sum.amountAED ?? 0] as const));
  const scopeTotal = breakdown.reduce((s, b) => s + (b._sum.amountAED ?? 0), 0);
  const chipCats = [...EXPENSE_TAB_CATEGORIES]; // Expenses tab = reception's short list

  // Build hrefs preserving the current month + q; the chip sets/clears the category.
  const href = (category: string | null) => {
    const p = new URLSearchParams();
    p.set("month", month);
    if (category && category !== "ALL") p.set("category", category);
    if (q) p.set("q", q);
    return `/erp/expenses?${p.toString()}`;
  };
  const exportHref = () => {
    const p = new URLSearchParams({ month });
    if (selectedCategory !== "ALL") p.set("category", selectedCategory);
    if (q) p.set("q", q);
    return `/api/erp/expenses/export?${p.toString()}`;
  };
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs whitespace-nowrap ${active ? "border-gold bg-gold/10 text-gold" : "border-ink-line text-sand hover:border-gold/50"}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-cream">Expenses</h1>
          <p className="text-sm text-muted">Log a purchase with its date, amount, invoice number and a photo of the receipt.</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker months={recentMonths(12)} current={month} />
          <a href={exportHref()} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line px-3 py-2 text-sm text-sand hover:border-gold/50 hover:text-gold" title="Export this month to CSV">
            <Download size={14} /> CSV
          </a>
        </div>
      </div>

      <div className="surface flex items-center justify-between gap-4 rounded-2xl p-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">
            {selectedCategory === "ALL" ? "Logged" : `${cap(selectedCategory)} in`} {monthLabel(month)}
          </div>
          <div className="font-display text-3xl text-gold">{aed(filteredTotal)}</div>
        </div>
        <div className="text-right text-sm text-muted">
          {filteredAgg._count} expense{filteredAgg._count === 1 ? "" : "s"}
          {!isManager && <div className="text-xs">by you</div>}
        </div>
      </div>

      {/* Category chips + per-category month breakdown */}
      <div className="flex flex-wrap gap-2">
        <Link href={href("ALL")} className={chip(selectedCategory === "ALL")}>All · {aed(scopeTotal)}</Link>
        {chipCats.map((c) => (
          <Link key={c} href={href(c)} className={chip(selectedCategory === c)}>
            {cap(c)} · {aed(sums.get(c) ?? 0)}
          </Link>
        ))}
      </div>

      <div className="surface rounded-2xl p-5">
        <AddExpenseForm categories={[...EXPENSE_TAB_CATEGORIES]} />
      </div>

      <div className="surface rounded-2xl p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg text-cream">{isManager ? "Expenses" : "Expenses you've logged"}</h2>
          <SearchBox placeholder="Search by description or invoice #…" className="max-w-xs" />
        </div>
        <div className="divide-y divide-ink-line/60">
          {expenses.length === 0 && <p className="py-6 text-center text-sm text-muted">{q ? `No expenses match “${q}”.` : "No expenses for this filter."}</p>}
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
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold text-sand">{aed(e.amountAED)}</span>
                <ExpenseActions
                  expense={{ id: e.id, category: e.category, description: e.description, amountAED: e.amountAED, incurredOn: e.incurredOn.toISOString(), invoiceNo: e.invoiceNo }}
                  categories={isManager ? EXPENSE_CATEGORIES : EXPENSE_TAB_CATEGORIES}
                />
              </div>
            </div>
          ))}
        </div>
        <Pagination total={win.total} page={win.page} size={win.size} />
      </div>
    </div>
  );
}
