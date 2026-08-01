import Link from "next/link";
import { ArrowRight, Users, FileBarChart, Receipt, Wallet } from "lucide-react";
import { aed } from "@/lib/utils";
import type { MonthClose as MonthCloseData } from "@/lib/month-close-core";
import { MonthPicker } from "./MonthPicker";

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "gold" | "loss" }) {
  const valueClass = tone === "gold" ? "text-gold-gradient" : tone === "loss" ? "text-red-400" : "text-cream";
  return (
    <div className="rounded-2xl border border-ink-line bg-ink-card p-4">
      <div className="text-[0.65rem] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 font-display text-2xl ${valueClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

/** Single-series magnitude bars (weekly / monthly-trend). Gold, baseline-anchored, hover tooltip. */
function Bars({ title, bars, highlight }: { title: string; bars: { label: string; grossAED: number }[]; highlight?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.grossAED));
  return (
    <div className="rounded-2xl border border-ink-line bg-ink-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      <div className="mt-3 flex h-28 items-stretch gap-1.5">
        {bars.map((b, i) => (
          <div key={i} className="group flex h-full flex-1 flex-col justify-end" title={`${b.label}: ${aed(b.grossAED)}`}>
            <div
              className={`rounded-t ${highlight && b.label === highlight ? "bg-gold" : "bg-gold/60 group-hover:bg-gold"}`}
              style={{ height: `${Math.max(2, Math.round((b.grossAED / max) * 100))}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 text-center text-[0.6rem] text-muted">{b.label}</div>
        ))}
      </div>
    </div>
  );
}

export function MonthClose({ data, months }: { data: MonthCloseData; months: string[] }) {
  const loss = data.netProfitAED < 0;
  const maxSlice = Math.max(1, ...data.expenseSlices.map((s) => s.amountAED));
  const staffPay = "/erp/staff?month=" + data.month;
  const [my, mm] = data.month.split("-").map(Number);
  const lastDay = String(new Date(Date.UTC(my, mm, 0)).getUTCDate()).padStart(2, "0");
  const plHref = `/erp/finance/pl?period=custom&from=${data.month}-01&to=${data.month}-${lastDay}`;

  return (
    <section className="surface space-y-6 rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-cream">Month close</h2>
          <p className="text-xs text-muted">Sales, salaries and expenses for {data.label}{data.isCurrent ? " (so far)" : ""}.</p>
        </div>
        <MonthPicker months={months} current={data.month} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Gross sales" value={aed(data.sales.grossAED)} sub={`${data.sales.orders} bills`} />
        <Tile label="Net (ex-VAT)" value={aed(data.sales.netAED)} sub={`${aed(data.sales.vatAED)} VAT`} />
        <Tile label="Salaries" value={aed(data.salaries.netAED)} sub={`${aed(data.salaries.outstandingAED)} to pay`} />
        <Tile label="Other expenses" value={aed(data.otherExpensesAED)} />
        <Tile label={loss ? "Net loss" : "Net profit"} value={aed(data.netProfitAED)} tone={loss ? "loss" : "gold"} sub="Net − salaries − expenses" />
      </div>

      {/* Salary close status */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
        <div className="text-sm text-sand">
          <Wallet size={15} className="mr-1.5 inline text-gold" />
          Salaries: <span className="font-semibold text-cream">{data.salaries.paidCount} of {data.salaries.owedCount}</span> staff paid
          {data.salaries.outstandingAED > 0
            ? <> · <span className="font-semibold text-gold">{aed(data.salaries.outstandingAED)}</span> outstanding</>
            : data.salaries.owedCount > 0 ? <> · <span className="text-green-500">all paid</span></> : null}
        </div>
        <Link href={staffPay} className="inline-flex items-center gap-1.5 rounded-full bg-gold-gradient px-4 py-1.5 text-sm font-semibold text-espresso">
          <Users size={14} /> Close salaries
        </Link>
      </div>

      {/* Trajectory */}
      <div className="grid gap-3 md:grid-cols-2">
        <Bars title="Weekly sales" bars={data.weekly} />
        <Bars title="Last 6 months" bars={data.trend.map((t) => ({ label: t.label, grossAED: t.grossAED }))} highlight={data.trend.find((t) => t.month === data.month)?.label} />
      </div>

      {/* Where it went */}
      {data.expenseSlices.length > 0 && (
        <div className="rounded-2xl border border-ink-line bg-ink-card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Where the money went</h3>
          <div className="space-y-2">
            {data.expenseSlices.map((s) => (
              <div key={s.label} className="flex items-center gap-3 text-sm">
                <div className="w-40 shrink-0 truncate text-sand">{s.label}</div>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink">
                  <div className={`h-full rounded-full ${s.kind === "salaries" ? "bg-gold" : "bg-gold/50"}`} style={{ width: `${Math.max(3, Math.round((s.amountAED / maxSlice) * 100))}%` }} />
                </div>
                <div className="w-24 shrink-0 text-right tabular-nums text-cream">{aed(s.amountAED)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Link href={staffPay} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line px-3 py-1.5 text-xs text-sand hover:text-gold"><Users size={13} /> Payroll</Link>
        <Link href={plHref} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line px-3 py-1.5 text-xs text-sand hover:text-gold"><FileBarChart size={13} /> P&amp;L report</Link>
        <Link href="/erp/finance" className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line px-3 py-1.5 text-xs text-sand hover:text-gold"><Wallet size={13} /> Finance</Link>
        <Link href="/erp/sales" className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line px-3 py-1.5 text-xs text-sand hover:text-gold"><Receipt size={13} /> Sales <ArrowRight size={12} /></Link>
      </div>
    </section>
  );
}
