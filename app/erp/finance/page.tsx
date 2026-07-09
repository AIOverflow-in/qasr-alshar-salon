import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, FINANCE_ROLES } from "@/lib/auth";
import { aed } from "@/lib/utils";
import { getMonthlyRevenue, monthStartUTC } from "@/lib/finance";
import { FinanceManager } from "@/components/erp/FinanceManager";
import { ScheduledPayments } from "@/components/erp/ScheduledPayments";
import { Pagination } from "@/components/erp/Pagination";
import { SendDigestButton } from "@/components/erp/SendDigestButton";
import { parsePage, pageWindow } from "@/lib/pagination-core";

export const dynamic = "force-dynamic";

const TARGET = 100_000;

export default async function ErpFinance({ searchParams }: { searchParams: Promise<{ ep?: string; cp?: string; sp?: string }> }) {
  const ok = await requireRole(FINANCE_ROLES);
  if (!ok) redirect("/erp");
  const canEdit = ok.role === "SUPER_ADMIN" || ok.role === "ADMIN";

  const monthStart = monthStartUTC();
  const qp = await searchParams;

  // Each of the three lists paginates independently via its own URL param.
  const [expTotal, capTotal, schTotal] = await Promise.all([
    prisma.expense.count(),
    prisma.capitalEntry.count(),
    prisma.scheduledPayment.count(),
  ]);
  const expWin = pageWindow(expTotal, parsePage(qp.ep));
  const capWin = pageWindow(capTotal, parsePage(qp.cp));
  const schWin = pageWindow(schTotal, parsePage(qp.sp));

  const [revenue, monthExpenseAgg, expenses, capital, capitalAgg, scheduled] = await Promise.all([
    getMonthlyRevenue(),
    prisma.expense.aggregate({ _sum: { amountAED: true }, where: { incurredOn: { gte: monthStart } } }),
    prisma.expense.findMany({ orderBy: { incurredOn: "desc" }, skip: expWin.skip, take: expWin.take }),
    prisma.capitalEntry.findMany({ orderBy: { contributedOn: "desc" }, skip: capWin.skip, take: capWin.take }),
    prisma.capitalEntry.aggregate({ _sum: { amountAED: true } }),
    prisma.scheduledPayment.findMany({ orderBy: { dueDate: "asc" }, skip: schWin.skip, take: schWin.take }),
  ]);

  const monthExpenses = monthExpenseAgg._sum.amountAED ?? 0;
  const capitalTotal = capitalAgg._sum.amountAED ?? 0;
  const projectedDividend = Math.max(0, revenue.net - monthExpenses);

  const cards = [
    { label: "Monthly Revenue (gross)", value: aed(revenue.gross), sub: `${Math.round((revenue.gross / TARGET) * 100)}% of ${aed(TARGET)} target · ${revenue.orders} invoices` },
    { label: "Net Sales (ex-VAT)", value: aed(revenue.net), sub: "True revenue for dividends" },
    { label: "VAT Collected (5%)", value: aed(revenue.vat), sub: "Held for the tax authority" },
    { label: "Expenses (this month)", value: aed(monthExpenses), sub: "Sum of recorded expenses" },
    { label: "Projected Dividend", value: aed(projectedDividend), sub: "Net sales − expenses" },
    { label: "Investor Capital", value: aed(capitalTotal), sub: "Total contributions tracked" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-cream">Finance &amp; Investor</h1>
          <p className="text-sm text-muted">{ok.role === "INVESTOR" ? "Investor view (read-only)" : "Owner / manager view"}</p>
        </div>
        {canEdit && <SendDigestButton />}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="surface rounded-2xl p-5">
            <div className="font-display text-2xl text-gold-gradient">{c.value}</div>
            <div className="mt-1 text-sm text-cream">{c.label}</div>
            <div className="text-xs text-muted">{c.sub}</div>
          </div>
        ))}
      </div>

      <div>
        <ScheduledPayments
          canEdit={canEdit}
          payments={scheduled.map((p) => ({
            id: p.id, label: p.label, category: p.category, amountAED: p.amountAED, dueDate: p.dueDate.toISOString(),
            payee: p.payee, method: p.method, reference: p.reference, status: p.status, paidAt: p.paidAt ? p.paidAt.toISOString() : null, remindDaysBefore: p.remindDaysBefore,
          }))}
        />
        <Pagination total={schWin.total} page={schWin.page} size={schWin.size} param="sp" />
      </div>

      <FinanceManager
        canEdit={canEdit}
        expenses={expenses.map((e) => ({ id: e.id, category: e.category, description: e.description, amountAED: e.amountAED, incurredOn: e.incurredOn.toISOString(), recurring: e.recurring, invoiceNo: e.invoiceNo, receiptUrl: e.receiptUrl }))}
        capital={capital.map((c) => ({ id: c.id, investor: c.investor, amountAED: c.amountAED, contributedOn: c.contributedOn.toISOString() }))}
        expenseWin={{ total: expWin.total, page: expWin.page, size: expWin.size }}
        capitalWin={{ total: capWin.total, page: capWin.page, size: capWin.size }}
      />
    </div>
  );
}
