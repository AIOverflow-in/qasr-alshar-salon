"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { addExpense, deleteExpense, addCapital, deleteCapital } from "@/lib/actions/finance";
import { aed } from "@/lib/utils";

type Expense = { id: string; category: string; description: string; amountAED: number; incurredOn: string; recurring: boolean };
type Capital = { id: string; investor: string; amountAED: number; contributedOn: string };

const CATEGORIES = ["RENT", "UTILITIES", "SALARIES", "VISA", "SUPPLIES", "MARKETING", "MAINTENANCE", "OTHER"];

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

export function FinanceManager({ expenses, capital, canEdit }: { expenses: Expense[]; capital: Capital[]; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const [exp, setExp] = useState({ category: "RENT", description: "", amountAED: "", incurredOn: "" });
  const [cap, setCap] = useState({ investor: "", amountAED: "", contributedOn: "" });
  const [error, setError] = useState<string | null>(null);

  const input = "rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60";

  function submitExpense() {
    setError(null);
    if (!exp.description.trim() || !Number(exp.amountAED)) { setError("Add a description and amount."); return; }
    start(async () => {
      try {
        await addExpense({ category: exp.category, description: exp.description, amountAED: Number(exp.amountAED), incurredOn: exp.incurredOn || null });
        setExp({ category: "RENT", description: "", amountAED: "", incurredOn: "" });
      } catch { setError("Could not save expense."); }
    });
  }

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

        {canEdit && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <select value={exp.category} onChange={(e) => setExp((p) => ({ ...p, category: e.target.value }))} className={`${input} col-span-1`}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}
            </select>
            <input type="date" value={exp.incurredOn} onChange={(e) => setExp((p) => ({ ...p, incurredOn: e.target.value }))} className={input} />
            <input value={exp.description} onChange={(e) => setExp((p) => ({ ...p, description: e.target.value }))} placeholder="Description" className={`${input} col-span-2`} />
            <input type="number" value={exp.amountAED} onChange={(e) => setExp((p) => ({ ...p, amountAED: e.target.value }))} placeholder="Amount AED" className={input} />
            <button onClick={submitExpense} disabled={pending} className="flex items-center justify-center gap-1.5 rounded-lg bg-gold-gradient px-3 py-2 text-sm font-semibold text-espresso disabled:opacity-50">
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
            </button>
          </div>
        )}

        <div className="mt-4 divide-y divide-ink-line/60">
          {expenses.length === 0 && <p className="py-6 text-center text-sm text-muted">No expenses recorded yet.</p>}
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate text-cream">{e.description} {e.recurring && <span className="text-[0.6rem] text-gold">· recurring</span>}</div>
                <div className="text-xs text-muted">{e.category[0] + e.category.slice(1).toLowerCase()} · {fmtDate(e.incurredOn)}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sand">{aed(e.amountAED)}</span>
                {canEdit && (
                  <button onClick={() => start(() => deleteExpense(e.id))} className="text-muted hover:text-red-400"><Trash2 size={14} /></button>
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
          <div className="mt-4 grid grid-cols-2 gap-2">
            <input value={cap.investor} onChange={(e) => setCap((p) => ({ ...p, investor: e.target.value }))} placeholder="Investor name" className={`${input} col-span-2`} />
            <input type="number" value={cap.amountAED} onChange={(e) => setCap((p) => ({ ...p, amountAED: e.target.value }))} placeholder="Amount AED" className={input} />
            <input type="date" value={cap.contributedOn} onChange={(e) => setCap((p) => ({ ...p, contributedOn: e.target.value }))} className={input} />
            <button onClick={submitCapital} disabled={pending} className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg bg-gold-gradient px-3 py-2 text-sm font-semibold text-espresso disabled:opacity-50">
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
                  <button onClick={() => start(() => deleteCapital(c.id))} className="text-muted hover:text-red-400"><Trash2 size={14} /></button>
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
