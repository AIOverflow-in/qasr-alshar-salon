"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Target, Pencil, Check, X, AlertTriangle } from "lucide-react";
import { aed, cn } from "@/lib/utils";
import { setCategoryBudget } from "@/lib/actions/finance";
import { EXPENSE_CATEGORIES, expenseCategoryLabel } from "@/lib/expense-filter";
import type { BudgetSummary } from "@/lib/budget-core";

/** Monthly budget vs actual spend, per expense category. Managers set the budget inline. */
export function BudgetPanel({ data, canEdit, monthLabel }: { data: BudgetSummary; canEdit: boolean; monthLabel: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("RENT");
  const [pending, start] = useTransition();

  const save = (category: string, amount: string) => {
    start(async () => {
      await setCategoryBudget(category, parseInt(amount) || 0);
      setEditing(null); setAdding(false); router.refresh();
    });
  };

  const budgeted = new Set(data.rows.filter((r) => r.budgetAED > 0).map((r) => r.category));
  const available = EXPENSE_CATEGORIES.filter((c) => !budgeted.has(c));

  return (
    <section className="surface rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl text-cream"><Target size={18} className="text-gold" /> Budget</h2>
          <p className="text-xs text-muted">What you planned to spend vs what you actually spent — {monthLabel}.</p>
        </div>
        {canEdit && available.length > 0 && (
          <button onClick={() => { setAdding(true); setNewCat(available[0]); setValue(""); }}
            className="rounded-full border border-gold/40 px-4 py-1.5 text-sm text-gold hover:bg-gold/10">
            Set a budget
          </button>
        )}
      </div>

      {/* totals */}
      {data.anyBudgetSet && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile label="Budgeted" value={aed(data.totalBudget)} />
          <Tile label="Spent" value={aed(data.totalSpent)} />
          <Tile
            label={data.totalRemaining < 0 ? "Over budget" : "Left to spend"}
            value={aed(Math.abs(data.totalRemaining))}
            tone={data.totalRemaining < 0 ? "bad" : "good"}
          />
        </div>
      )}

      {data.overCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-600">
          <AlertTriangle size={15} /> {data.overCount} categor{data.overCount === 1 ? "y is" : "ies are"} over budget this month.
        </div>
      )}

      {adding && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-gold/40 bg-gold/5 p-3">
          <select value={newCat} onChange={(e) => setNewCat(e.target.value)}
            className="rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60">
            {available.map((c) => <option key={c} value={c}>{expenseCategoryLabel(c)}</option>)}
          </select>
          <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Monthly budget (AED)"
            className="w-48 rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60" />
          <button onClick={() => save(newCat, value)} disabled={pending}
            className="rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso disabled:opacity-50">Save</button>
          <button onClick={() => setAdding(false)} className="rounded-lg border border-ink-line px-3 py-2 text-sm text-sand">Cancel</button>
        </div>
      )}

      {data.rows.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted">
          No spending yet this month.{canEdit ? " Set a budget to start tracking against it." : ""}
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {data.rows.map((r) => {
            const pct = Math.min(100, r.pctUsed);
            return (
              <div key={r.category} className="rounded-xl border border-ink-line p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-cream">{r.label}</span>
                  <span className="text-sm tabular-nums text-sand">
                    {aed(r.spentAED)}
                    {r.budgetAED > 0 && <span className="text-muted"> of {aed(r.budgetAED)}</span>}
                  </span>
                </div>

                {r.budgetAED > 0 ? (
                  <>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink">
                      <div className={cn("h-full rounded-full", r.over ? "bg-red-500" : pct > 85 ? "bg-amber-500" : "bg-gold")}
                        style={{ width: `${Math.max(2, pct)}%` }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[0.65rem]">
                      <span className={r.over ? "text-red-600" : "text-muted"}>
                        {r.over ? `${aed(-r.remainingAED)} over` : `${aed(r.remainingAED)} left`} · {r.pctUsed}% used
                      </span>
                      {canEdit && (editing === r.category ? (
                        <span className="flex items-center gap-1">
                          <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} autoFocus
                            className="w-24 rounded border border-ink-line bg-ink-card px-2 py-0.5 text-xs text-cream outline-none focus:border-gold/60" />
                          <button onClick={() => save(r.category, value)} disabled={pending} className="text-green-600" aria-label="Save"><Check size={13} /></button>
                          <button onClick={() => setEditing(null)} className="text-muted" aria-label="Cancel"><X size={13} /></button>
                        </span>
                      ) : (
                        <button onClick={() => { setEditing(r.category); setValue(String(r.budgetAED)); }}
                          className="inline-flex items-center gap-1 text-muted hover:text-gold">
                          <Pencil size={11} /> edit
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  canEdit && (
                    editing === r.category ? (
                      <div className="mt-2 flex items-center gap-1">
                        <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} autoFocus placeholder="AED"
                          className="w-28 rounded border border-ink-line bg-ink-card px-2 py-1 text-xs text-cream outline-none focus:border-gold/60" />
                        <button onClick={() => save(r.category, value)} disabled={pending} className="text-green-600" aria-label="Save"><Check size={14} /></button>
                        <button onClick={() => setEditing(null)} className="text-muted" aria-label="Cancel"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditing(r.category); setValue(""); }} className="mt-1.5 text-[0.65rem] text-muted hover:text-gold">
                        + set a budget for this
                      </button>
                    )
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-[0.65rem] text-muted">Salaries come from payroll; everything else from logged expenses. Budgets carry over each month until you change them.</p>
    </section>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-ink-line bg-ink-card p-3">
      <div className="text-[0.65rem] uppercase tracking-wider text-muted">{label}</div>
      <div className={cn("mt-0.5 font-display text-xl", tone === "bad" ? "text-red-400" : tone === "good" ? "text-gold-gradient" : "text-cream")}>{value}</div>
    </div>
  );
}
