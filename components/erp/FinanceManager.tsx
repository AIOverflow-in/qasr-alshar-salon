"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, Paperclip } from "lucide-react";
import { deleteExpense, addCapital, deleteCapital } from "@/lib/actions/finance";
import { AddExpenseForm } from "./AddExpenseForm";
import { aed } from "@/lib/utils";

type Expense = { id: string; category: string; description: string; amountAED: number; incurredOn: string; recurring: boolean; invoiceNo?: string | null; receiptUrl?: string | null };
type Capital = { id: string; investor: string; amountAED: number; contributedOn: string };

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

export function FinanceManager({ expenses, capital, canEdit }: { expenses: Expense[]; capital: Capital[]; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const [cap, setCap] = useState({ investor: "", amountAED: "", contributedOn: "" });
  const [error, setError] = useState<string | null>(null);

  const input = "rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60";

  function submitCapital() {
    setError(null);
    if (!cap.investor.trim() || !Number(cap.amountAED)) { setError("Add an investor and amount."); return; }
    start(async () => {
      try {
        await addCapital({ investor: cap.investor, amountAED: Number(cap.amountAED), contributedOn: cap.contributedOn || null });
        setCap({ investor: "", amountAED: "", contributedOn: "" });
      } catch { setError("Could not save capital entry."); }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Expenses */}
      <div className="surface rounded-2xl p-5">
        <h2 className="font-display text-xl text-cream">Expenses</h2>
        <p className="text-xs text-muted">Rent, utilities, salaries, visas & supplies. Feeds the dividend calc.</p>

        {canEdit && <div className="mt-4"><AddExpenseForm showRecurring /></div>}

        <div className="mt-4 divide-y divide-ink-line/60">
          {expenses.length === 0 && <p className="py-6 text-center text-sm text-muted">No expenses recorded yet.</p>}
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate text-cream">{e.description} {e.recurring && <span className="text-[0.6rem] text-gold">· recurring</span>}</div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  <span>{e.category[0] + e.category.slice(1).toLowerCase()} · {fmtDate(e.incurredOn)}</span>
                  {e.invoiceNo && <span>· inv {e.invoiceNo}</span>}
                  {e.receiptUrl && <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-gold hover:underline"><Paperclip size={11} /> receipt</a>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sand">{aed(e.amountAED)}</span>
                {canEdit && (
                  <button onClick={() => start(() => deleteExpense(e.id))} aria-label="Delete expense" className="-m-2 p-2 text-muted hover:text-red-400"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Capital */}
      <div className="surface rounded-2xl p-5">
        <h2 className="font-display text-xl text-cream">Investor Capital</h2>
        <p className="text-xs text-muted">Contributions tracked against dividends.</p>

        {canEdit && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={cap.investor} onChange={(e) => setCap((p) => ({ ...p, investor: e.target.value }))} placeholder="Investor name" className={`${input} sm:col-span-2`} />
            <input type="number" value={cap.amountAED} onChange={(e) => setCap((p) => ({ ...p, amountAED: e.target.value }))} placeholder="Amount AED" className={input} />
            <input type="date" value={cap.contributedOn} onChange={(e) => setCap((p) => ({ ...p, contributedOn: e.target.value }))} className={input} />
            <button onClick={submitCapital} disabled={pending} className="flex items-center justify-center gap-1.5 rounded-lg bg-gold-gradient px-3 py-2 text-sm font-semibold text-espresso disabled:opacity-50 sm:col-span-2">
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add contribution
            </button>
          </div>
        )}

        <div className="mt-4 divide-y divide-ink-line/60">
          {capital.length === 0 && <p className="py-6 text-center text-sm text-muted">No capital entries yet.</p>}
          {capital.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate text-cream">{c.investor}</div>
                <div className="text-xs text-muted">{fmtDate(c.contributedOn)}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sand">{aed(c.amountAED)}</span>
                {canEdit && (
                  <button onClick={() => start(() => deleteCapital(c.id))} aria-label="Delete capital entry" className="-m-2 p-2 text-muted hover:text-red-400"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="lg:col-span-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}
    </div>
  );
}
