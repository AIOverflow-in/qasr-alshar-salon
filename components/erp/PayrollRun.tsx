"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Download, Wallet } from "lucide-react";
import { aed, cn } from "@/lib/utils";
import { payAllDue } from "@/lib/actions/admin";

/**
 * The payroll headline for the selected month — the first thing a manager should see.
 *
 * Design intent: answer "is this month done, and what do I owe?" before any table is read, and put
 * the one action that closes the month right next to that answer. Everything else on the page is
 * detail behind this.
 */
export function PayrollRun({
  month,
  monthLabel,
  isCurrentMonth,
  dueCount,
  paidCount,
  outstandingAED,
  netAED,
  totalSalesAED,
}: {
  month: string;
  monthLabel: string;
  isCurrentMonth: boolean;
  dueCount: number;
  paidCount: number;
  outstandingAED: number;
  netAED: number;
  totalSalesAED: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalPeople = dueCount + paidCount;
  const settled = dueCount === 0 && totalPeople > 0;
  const pctPaid = totalPeople > 0 ? Math.round((paidCount / totalPeople) * 100) : 0;

  function closeMonth() {
    if (!window.confirm(`Pay ${dueCount} ${dueCount === 1 ? "artist" : "artists"} a total of ${aed(outstandingAED)} for ${monthLabel}?\n\nThis records each payslip and emails it to anyone with a login.`)) return;
    setError(null);
    start(async () => {
      try {
        await payAllDue(month);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not complete the payroll run.");
      }
    });
  }

  const tiles = [
    { label: "Total sales", value: aed(totalSalesAED), hint: "ex-VAT, this month" },
    { label: "Net salary", value: aed(netAED), hint: "what the team earned" },
    { label: "Gross profit", value: aed(totalSalesAED - netAED), hint: "sales − salary" },
  ];

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        {/* The answer */}
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-widest text-muted">
            <Wallet size={13} className="text-gold" />
            {monthLabel} payroll{isCurrentMonth ? " · in progress" : ""}
          </div>

          {settled ? (
            <>
              <div className="mt-2 flex items-baseline gap-2.5">
                <CheckCircle2 size={26} className="shrink-0 translate-y-1 text-green-400" />
                <span className="font-display text-4xl text-cream">All paid</span>
              </div>
              <p className="mt-1.5 text-sm text-muted">
                Every artist due for {monthLabel} has been paid — {aed(netAED)} across {paidCount} {paidCount === 1 ? "person" : "people"}.
              </p>
            </>
          ) : totalPeople === 0 ? (
            <>
              <div className="mt-2 font-display text-4xl text-cream">Nothing to pay</div>
              <p className="mt-1.5 text-sm text-muted">No artist earned anything in {monthLabel} yet.</p>
            </>
          ) : (
            <>
              <div className="mt-2 font-display text-4xl text-gold-gradient">{aed(outstandingAED)}</div>
              <p className="mt-1.5 text-sm text-sand">
                still to pay — {dueCount} of {totalPeople} {totalPeople === 1 ? "artist" : "artists"} waiting
              </p>
            </>
          )}

          {/* How far through the month's payroll we are */}
          {totalPeople > 0 && (
            <div className="mt-4 max-w-sm">
              <div className="h-1.5 overflow-hidden rounded-full bg-ink">
                <div
                  className={cn("h-full rounded-full transition-all", settled ? "bg-green-500" : "bg-gold")}
                  style={{ width: `${Math.max(2, pctPaid)}%` }}
                />
              </div>
              <div className="mt-1.5 text-[0.65rem] text-muted">{paidCount} of {totalPeople} paid · {pctPaid}%</div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            {dueCount > 0 && (
              <button
                onClick={closeMonth}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 text-sm font-semibold text-espresso disabled:opacity-50"
              >
                {pending ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
                {pending ? "Paying…" : `Pay all ${dueCount} due`}
              </button>
            )}
            <a
              href={`/api/erp/payroll/export?month=${month}`}
              className="inline-flex items-center gap-2 rounded-full border border-ink-line px-4 py-2.5 text-sm text-sand hover:border-gold/50 hover:text-gold"
            >
              <Download size={14} /> Export CSV
            </a>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/5 p-2.5 text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* The month's money, at a glance */}
        <div className="grid grid-cols-3 divide-x divide-ink-line rounded-2xl border border-ink-line">
          {tiles.map((t) => (
            <div key={t.label} className="px-3 py-4 text-center">
              <div className="font-display text-lg text-cream sm:text-xl">{t.value}</div>
              <div className="mt-1 text-[0.6rem] uppercase tracking-wider text-muted">{t.label}</div>
              <div className="mt-0.5 text-[0.6rem] text-muted/70">{t.hint}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
