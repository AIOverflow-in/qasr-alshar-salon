import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole, FINANCE_ROLES } from "@/lib/auth";
import { aed } from "@/lib/utils";
import { getProfitAndLoss } from "@/lib/finance";
import { resolvePLRange } from "@/lib/pl-core";
import { PLControls } from "@/components/erp/PLControls";

export const dynamic = "force-dynamic";

export default async function ErpProfitAndLoss({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const ok = await requireRole(FINANCE_ROLES);
  if (!ok) redirect("/erp");

  const qp = await searchParams;
  const period = resolvePLRange({ period: qp.period, from: qp.from, to: qp.to });
  const r = await getProfitAndLoss(period);

  const dlParams = period.period === "custom" ? `period=custom&from=${period.from}&to=${period.to}` : `period=${period.period}`;
  const pdfHref = `/api/erp/finance/pl?${dlParams}&format=pdf`;
  const csvHref = `/api/erp/finance/pl?${dlParams}&format=csv`;
  const loss = r.netProfit < 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/erp/finance" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold">
          <ArrowLeft size={15} /> Finance
        </Link>
        <h1 className="mt-2 font-display text-3xl text-cream">Profit &amp; Loss</h1>
        <p className="text-sm text-muted">Income and expenses for tax filing — download as PDF or CSV. QuickBooks-style, built in.</p>
      </div>

      <PLControls period={period.period} from={period.from} to={period.to} pdfHref={pdfHref} csvHref={csvHref} />

      {/* Statement */}
      <div className="surface rounded-2xl p-6 space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-line pb-4">
          <div>
            <div className="font-display text-2xl text-cream">{period.label}</div>
            <div className="text-xs text-muted">{period.from} to {period.to}</div>
          </div>
          <div className="text-right">
            <div className={`font-display text-3xl ${loss ? "text-red-400" : "text-gold-gradient"}`}>{aed(r.netProfit)}</div>
            <div className="text-xs text-muted">{loss ? "Net loss" : "Net profit"} · {r.netMarginPct}% margin</div>
          </div>
        </div>

        {/* Income */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold">Income</h2>
          <dl className="divide-y divide-ink-line/60">
            {r.income.length ? r.income.map((l) => (
              <div key={l.label} className="flex justify-between py-2 text-sm">
                <dt className="text-sand">{l.label}</dt>
                <dd className="tabular-nums text-cream">{aed(l.amountAED)}</dd>
              </div>
            )) : (
              <div className="py-2 text-sm text-muted">No income recorded in this period.</div>
            )}
            <div className="flex justify-between py-2.5 text-sm font-semibold">
              <dt className="text-cream">Total income</dt>
              <dd className="tabular-nums text-cream">{aed(r.totalIncome)}</dd>
            </div>
          </dl>
          {r.vatCollected > 0 && (
            <p className="mt-1 text-xs text-muted">VAT collected {aed(r.vatCollected)} — held for the FTA, excluded from income.</p>
          )}
        </section>

        {/* Expenses */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold">Operating expenses</h2>
          <dl className="divide-y divide-ink-line/60">
            {r.expenses.length ? r.expenses.map((l) => (
              <div key={l.label} className="flex justify-between py-2 text-sm">
                <dt className="text-sand">{l.label}</dt>
                <dd className="tabular-nums text-cream">{aed(l.amountAED)}</dd>
              </div>
            )) : (
              <div className="py-2 text-sm text-muted">No expenses recorded in this period.</div>
            )}
            <div className="flex justify-between py-2.5 text-sm font-semibold">
              <dt className="text-cream">Total expenses</dt>
              <dd className="tabular-nums text-cream">{aed(r.totalExpenses)}</dd>
            </div>
          </dl>
        </section>

        {/* Net */}
        <div className={`flex items-center justify-between rounded-xl px-5 py-4 ${loss ? "bg-red-500/10" : "bg-gold/10"}`}>
          <div>
            <div className="text-sm font-semibold text-cream">{loss ? "Net loss" : "Net profit"}</div>
            <div className="text-xs text-muted">Total income − total expenses</div>
          </div>
          <div className={`font-display text-3xl ${loss ? "text-red-400" : "text-gold-gradient"}`}>{aed(r.netProfit)}</div>
        </div>

        <p className="text-xs text-muted">{r.basisNote}</p>
      </div>
    </div>
  );
}
