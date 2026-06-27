import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, FINANCE_ROLES } from "@/lib/auth";
import { aed } from "@/lib/utils";
import { getMonthlyRevenue, monthStartUTC } from "@/lib/finance";
import { FinanceManager } from "@/components/erp/FinanceManager";

export const dynamic = "force-dynamic";

const TARGET = 100_000;

export default async function ErpFinance() {
  const ok = await requireRole(FINANCE_ROLES);
  if (!ok) redirect("/erp");
  const canEdit = ok.role === "SUPER_ADMIN" || ok.role === "ADMIN";

  const monthStart = monthStartUTC();

  const [revenue, monthExpenseAgg, expenses, capital, capitalAgg] = await Promise.all([
    getMonthlyRevenue(),
    prisma.expense.aggregate({ _sum: { amountAED: true }, where: { incurredOn: { gte: monthStart } } }),
    prisma.expense.findMany({ orderBy: { incurredOn: "desc" }, take: 100 }),
    prisma.capitalEntry.findMany({ orderBy: { contributedOn: "desc" }, take: 100 }),
    prisma.capitalEntry.aggregate({ _sum: { amountAED: true } }),
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
      <div>
        <h1 className="font-display text-3xl text-cream">Finance &amp; Investor</h1>
        <p className="text-sm text-muted">{ok.role === "INVESTOR" ? "Investor view (read-only)" : "Owner / manager view"}</p>
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

      <FinanceManager
        canEdit={canEdit}
        expenses={expenses.map((e) => ({ id: e.id, category: e.category, description: e.description, amountAED: e.amountAED, incurredOn: e.incurredOn.toISOString(), recurring: e.recurring }))}
        capital={capital.map((c) => ({ id: c.id, investor: c.investor, amountAED: c.amountAED, contributedOn: c.contributedOn.toISOString() }))}
      />
    </div>
  );
}
