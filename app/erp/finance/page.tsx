import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, FINANCE_ROLES } from "@/lib/auth";
import { aed } from "@/lib/utils";

export const dynamic = "force-dynamic";

function monthStartUTC() {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - 4 * 3600_000);
}

const TARGET = 100_000, SALARIES = 40_000, EXPENSES = 20_000, CAPITAL = 580_000;

export default async function ErpFinance() {
  const ok = await requireRole(FINANCE_ROLES);
  if (!ok) redirect("/erp");

  const agg = await prisma.booking.aggregate({
    _sum: { priceAED: true },
    where: { status: { in: ["CONFIRMED", "COMPLETED"] }, startAt: { gte: monthStartUTC() } },
  });
  const revenue = agg._sum.priceAED ?? 0;
  const projectedDividend = Math.max(0, revenue - SALARIES - EXPENSES);

  const cards = [
    { label: "Monthly Revenue (system)", value: aed(revenue), sub: `${Math.round((revenue / TARGET) * 100)}% of ${aed(TARGET)} target` },
    { label: "Target", value: aed(TARGET), sub: "Profitability threshold" },
    { label: "Salaries (budget)", value: aed(SALARIES), sub: "Monthly allocation" },
    { label: "Expenses (budget)", value: aed(EXPENSES), sub: "Rent, utilities, supplies" },
    { label: "Projected Dividend", value: aed(projectedDividend), sub: "Revenue − salaries − expenses" },
    { label: "Investor Capital", value: aed(CAPITAL), sub: "Initial investment to track" },
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
      <div className="surface rounded-2xl p-6 text-sm text-muted">
        <p className="text-cream">Coming in the finance slice:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Import the POS sales export (<span className="text-sand">Inv# · Date · Client · Amount · Sales Man</span>) for true revenue + VAT reporting.</li>
          <li>Expense entry (rent, utilities, visas) + capital breakdown of {aed(CAPITAL)} → automated dividend calculation.</li>
          <li>P&amp;L, sales-by-stylist, retention, and a read-only investor dashboard.</li>
        </ul>
      </div>
    </div>
  );
}
