import Link from "next/link";
import { ArrowRight, Users, FileBarChart, CheckCircle2 } from "lucide-react";
import { aed } from "@/lib/utils";
import type { MonthClose as MonthCloseData } from "@/lib/month-close-core";
import { MonthPicker } from "./MonthPicker";

/** A row in the money waterfall: sales in, costs out, what's left. */
function Line({ label, value, sub, strong, negative }: { label: string; value: string; sub?: string; strong?: boolean; negative?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "" : "py-2"}`}>
      <div className="min-w-0">
        <div className={strong ? "text-sm font-semibold text-cream" : "text-sm text-sand"}>{label}</div>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
      <div className={`shrink-0 tabular-nums ${strong ? "font-display text-xl text-cream" : negative ? "text-sand" : "text-cream"}`}>
        {negative ? `− ${value}` : value}
      </div>
    </div>
  );
}

export function MonthClose({ data, months }: { data: MonthCloseData; months: string[] }) {
  const loss = data.netProfitAED < 0;
  const settled = data.salaries.outstandingAED <= 0 && data.salaries.owedCount > 0;
  const maxSlice = Math.max(1, ...data.expenseSlices.map((s) => s.amountAED));
  const staffPay = `/erp/staff?month=${data.month}`;
  const [my, mm] = data.month.split("-").map(Number);
  const lastDay = String(new Date(Date.UTC(my, mm, 0)).getUTCDate()).padStart(2, "0");
  const plHref = `/erp/finance/pl?period=custom&from=${data.month}-01&to=${data.month}-${lastDay}`;
  const trendMax = Math.max(1, ...data.trend.map((t) => t.grossAED));

  return (
    <section className="surface overflow-hidden rounded-2xl">
      {/* Header — what this is, and which month */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-line px-6 py-4">
        <div>
          <h2 className="font-display text-xl text-cream">Close the month</h2>
          <p className="text-xs text-muted">Everything you need to pay staff and file — in one place.</p>
        </div>
        <MonthPicker months={months} current={data.month} />
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_1fr]">
        {/* LEFT — the answer + the money waterfall */}
        <div>
          <div className="text-[0.65rem] uppercase tracking-wider text-muted">
            {loss ? "Net loss" : "Net profit"} · {data.label}{data.isCurrent ? " so far" : ""}
          </div>
          <div className={`font-display text-4xl ${loss ? "text-red-400" : "text-gold-gradient"}`}>{aed(data.netProfitAED)}</div>

          <div className="mt-4 divide-y divide-ink-line/60 border-t border-ink-line/60">
            <Line label="Sales (net of VAT)" value={aed(data.sales.netAED)} sub={`${data.sales.orders} bills · ${aed(data.sales.grossAED)} collected`} />
            <Line label="Salaries & commissions" value={aed(data.salaries.netAED)} negative />
            <Line label="Other expenses" value={aed(data.otherExpensesAED)} negative />
          </div>
          <div className="mt-3 border-t-2 border-ink-line pt-3">
            <Line label={loss ? "Net loss" : "Net profit"} value={aed(data.netProfitAED)} strong />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={plHref} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line px-3 py-1.5 text-xs text-sand hover:text-gold">
              <FileBarChart size={13} /> P&amp;L for {data.label}
            </Link>
            <Link href="/erp/finance" className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line px-3 py-1.5 text-xs text-sand hover:text-gold">
              Expenses <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* RIGHT — the action, then supporting detail */}
        <div className="space-y-4">
          {/* Primary action: pay the staff */}
          <div className={`rounded-xl border p-4 ${settled ? "border-green-600/30 bg-green-500/5" : "border-gold/40 bg-gold/5"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[0.65rem] uppercase tracking-wider text-muted">Salaries</div>
                {settled ? (
                  <div className="mt-1 flex items-center gap-1.5 font-display text-xl text-green-600">
                    <CheckCircle2 size={18} /> All paid
                  </div>
                ) : (
                  <div className="mt-1 font-display text-2xl text-cream">{aed(data.salaries.outstandingAED)}</div>
                )}
                <div className="mt-0.5 text-xs text-muted">
                  {settled ? `${data.salaries.owedCount} staff settled` : `still to pay · ${data.salaries.paidCount} of ${data.salaries.owedCount} staff done`}
                </div>
              </div>
              <Link
                href={staffPay}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${settled ? "border border-ink-line text-sand hover:text-gold" : "bg-gold-gradient text-espresso"}`}
              >
                <Users size={14} /> {settled ? "View payroll" : "Pay staff"}
              </Link>
            </div>
            {!settled && data.salaries.owedCount > 0 && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink">
                <div className="h-full rounded-full bg-gold" style={{ width: `${Math.round((data.salaries.paidCount / data.salaries.owedCount) * 100)}%` }} />
              </div>
            )}
          </div>

          {/* Where the money went */}
          {data.expenseSlices.length > 0 && (
            <div className="rounded-xl border border-ink-line p-4">
              <h3 className="text-[0.65rem] uppercase tracking-wider text-muted">Where the money went</h3>
              <div className="mt-2.5 space-y-1.5">
                {data.expenseSlices.slice(0, 5).map((s) => (
                  <div key={s.label} className="flex items-center gap-2.5 text-xs">
                    <div className="w-28 shrink-0 truncate text-sand">{s.label}</div>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink">
                      <div className={`h-full rounded-full ${s.kind === "salaries" ? "bg-gold" : "bg-gold/45"}`} style={{ width: `${Math.max(3, Math.round((s.amountAED / maxSlice) * 100))}%` }} />
                    </div>
                    <div className="w-20 shrink-0 text-right tabular-nums text-cream">{aed(s.amountAED)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6-month trajectory — the one thing "This Month" can't show */}
          <div className="rounded-xl border border-ink-line p-4">
            <h3 className="text-[0.65rem] uppercase tracking-wider text-muted">Sales trend · last 6 months</h3>
            <div className="mt-2.5 flex h-16 items-stretch gap-1.5">
              {data.trend.map((t) => (
                <div key={t.month} className="group flex h-full flex-1 flex-col justify-end" title={`${t.label}: ${aed(t.grossAED)}`}>
                  <div
                    className={`rounded-t ${t.month === data.month ? "bg-gold" : "bg-gold/40 group-hover:bg-gold/70"}`}
                    style={{ height: `${Math.max(3, Math.round((t.grossAED / trendMax) * 100))}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {data.trend.map((t) => (
                <div key={t.month} className={`flex-1 text-center text-[0.6rem] ${t.month === data.month ? "font-semibold text-gold" : "text-muted"}`}>{t.label}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
