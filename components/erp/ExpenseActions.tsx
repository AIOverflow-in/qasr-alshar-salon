"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2, X } from "lucide-react";
import { updateExpense, deleteExpense } from "@/lib/actions/finance";

const label = (c: string) => c[0] + c.slice(1).toLowerCase();
const input = "rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60";

export type EditableExpense = { id: string; category: string; description: string; amountAED: number; incurredOn: string; invoiceNo: string | null };

/** Convert a stored ISO instant to a Dubai wall-clock value for <input type="datetime-local">. */
function toDubaiInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** Edit + delete a single expense. The server action enforces scope (reception = own only). */
export function ExpenseActions({ expense, categories }: { expense: EditableExpense; categories: readonly string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    category: expense.category,
    description: expense.description,
    amountAED: String(expense.amountAED),
    incurredOn: toDubaiInput(expense.incurredOn),
    invoiceNo: expense.invoiceNo ?? "",
  });

  function save() {
    setErr(null);
    if (!f.description.trim()) { setErr("Add a description."); return; }
    if (!Number(f.amountAED) || Number(f.amountAED) <= 0) { setErr("Add a positive amount."); return; }
    start(async () => {
      try {
        await updateExpense(expense.id, {
          category: f.category, description: f.description, amountAED: Number(f.amountAED),
          incurredOn: f.incurredOn || null, invoiceNo: f.invoiceNo || null,
        });
        setEditing(false);
        router.refresh();
      } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); }
    });
  }
  function remove() {
    if (!confirm("Delete this expense? This can't be undone.")) return;
    start(async () => { try { await deleteExpense(expense.id); router.refresh(); } catch (e) { alert(e instanceof Error ? e.message : "Could not delete."); } });
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={() => { setEditing(true); setErr(null); }} disabled={pending} aria-label="Edit expense" className="-m-1.5 p-1.5 text-muted hover:text-gold"><Pencil size={13} /></button>
        <button onClick={remove} disabled={pending} aria-label="Delete expense" className="-m-1.5 p-1.5 text-muted hover:text-red-600">{pending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}</button>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={() => setEditing(false)}>
          <div className="mt-10 w-full max-w-md rounded-2xl border border-ink-line bg-ink p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg text-cream">Edit expense</h3>
              <button onClick={() => setEditing(false)} aria-label="Close" className="-m-2 p-2 text-muted hover:text-cream"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))} className={input} aria-label="Category">
                {categories.map((c) => <option key={c} value={c}>{label(c)}</option>)}
              </select>
              <input type="datetime-local" value={f.incurredOn} onChange={(e) => setF((p) => ({ ...p, incurredOn: e.target.value }))} onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* not supported → native icon still works */ } }} className={input} aria-label="Date & time" title="Tap to pick the date & time" />
              <input value={f.description} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} placeholder="Description" className={`${input} sm:col-span-2`} />
              <input type="number" min={0} value={f.amountAED} onChange={(e) => setF((p) => ({ ...p, amountAED: e.target.value }))} placeholder="Amount AED" className={input} />
              <input value={f.invoiceNo} onChange={(e) => setF((p) => ({ ...p, invoiceNo: e.target.value }))} placeholder="Invoice # (optional)" className={input} />
            </div>
            {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="rounded-lg border border-ink-line px-4 py-2 text-sm text-sand hover:border-gold/50">Cancel</button>
              <button onClick={save} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso disabled:opacity-50">
                {pending ? <Loader2 size={14} className="animate-spin" /> : null} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
