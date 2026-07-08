"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, CalendarClock, Check, Undo2 } from "lucide-react";
import { addScheduledPayment, deleteScheduledPayment, setScheduledPaymentPaid } from "@/lib/actions/finance";
import { aed } from "@/lib/utils";

type Payment = {
  id: string; label: string; category: string; amountAED: number; dueDate: string;
  payee: string | null; method: string; reference: string | null; status: string; paidAt: string | null; remindDaysBefore: number;
};

const CATEGORIES = ["RENT", "UTILITIES", "SALARIES", "VISA", "SUPPLIES", "MARKETING", "MAINTENANCE", "OTHER"];
const METHODS = ["CHEQUE", "CASH", "TRANSFER"];

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}
const DAY = 86_400_000;
function daysUntil(iso: string) {
  const dubai = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return Math.round((Date.parse(dubai(new Date(iso)) + "T12:00:00") - Date.parse(dubai(new Date()) + "T12:00:00")) / DAY);
}
function statusBadge(p: Payment) {
  if (p.status === "PAID") return { text: p.paidAt ? `Paid ${fmtDate(p.paidAt)}` : "Paid", cls: "text-green-400" };
  const d = daysUntil(p.dueDate);
  if (d < 0) return { text: `Overdue ${-d}d`, cls: "text-red-400" };
  if (d === 0) return { text: "Due today", cls: "text-gold" };
  if (d <= p.remindDaysBefore) return { text: `Due in ${d}d`, cls: "text-gold" };
  return { text: `Due in ${d}d`, cls: "text-muted" };
}

export function ScheduledPayments({ payments, canEdit }: { payments: Payment[]; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ label: "", category: "RENT", amountAED: "", dueDate: "", payee: "", method: "CHEQUE", reference: "", remindDaysBefore: "7" });
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const input = "rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60";

  // Pending first (soonest due at top), then paid (most recent first).
  const sorted = [...payments].sort((a, b) => {
    if (a.status !== b.status) return a.status === "PENDING" ? -1 : 1;
    return a.status === "PENDING"
      ? new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      : new Date(b.paidAt ?? b.dueDate).getTime() - new Date(a.paidAt ?? a.dueDate).getTime();
  });
  const upcomingTotal = payments.filter((p) => p.status === "PENDING").reduce((s, p) => s + p.amountAED, 0);

  function submit() {
    setError(null);
    if (!form.label.trim() || !Number(form.amountAED) || !form.dueDate) { setError("Add a label, amount and due date."); return; }
    start(async () => {
      try {
        await addScheduledPayment({
          label: form.label, category: form.category, amountAED: Number(form.amountAED), dueDate: form.dueDate,
          payee: form.payee || null, method: form.method, reference: form.reference || null, remindDaysBefore: Number(form.remindDaysBefore) || 7,
        });
        setForm({ label: "", category: "RENT", amountAED: "", dueDate: "", payee: "", method: "CHEQUE", reference: "", remindDaysBefore: "7" });
        setShowAdd(false);
      } catch { setError("Could not save the payment."); }
    });
  }

  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl text-cream"><CalendarClock size={18} className="text-gold" /> Scheduled &amp; recurring payments</h2>
          <p className="text-xs text-muted">Rent cheques, utilities, licence renewals — you get an email reminder before each is due.</p>
        </div>
        <div className="text-right">
          <div className="font-display text-xl text-gold-gradient">{aed(upcomingTotal)}</div>
          <div className="text-xs text-muted">upcoming</div>
        </div>
      </div>

      {canEdit && (
        <div className="mt-3">
          {!showAdd ? (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-lg border border-gold/40 px-3 py-1.5 text-sm text-gold hover:bg-gold/10">
              <Plus size={14} /> Add a payment
            </button>
          ) : (
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-ink-line/60 p-3 sm:grid-cols-3">
              <input value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="Label (e.g. Shop rent — cheque #8)" className={`${input} sm:col-span-3`} />
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className={input}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}
              </select>
              <input type="number" value={form.amountAED} onChange={(e) => setForm((p) => ({ ...p, amountAED: e.target.value }))} placeholder="Amount AED" className={input} />
              <input type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} className={`${input} [color-scheme:dark]`} />
              <input value={form.payee} onChange={(e) => setForm((p) => ({ ...p, payee: e.target.value }))} placeholder="Payee (optional)" className={`${input} sm:col-span-1`} />
              <select value={form.method} onChange={(e) => setForm((p) => ({ ...p, method: e.target.value }))} className={input}>
                {METHODS.map((m) => <option key={m} value={m}>{m[0] + m.slice(1).toLowerCase()}</option>)}
              </select>
              <input value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Cheque / ref" className={input} />
              <label className="flex items-center gap-2 text-xs text-muted">
                Remind
                <input type="number" value={form.remindDaysBefore} onChange={(e) => setForm((p) => ({ ...p, remindDaysBefore: e.target.value }))} className={`${input} w-16`} /> days before
              </label>
              <div className="flex gap-2 sm:col-span-3">
                <button onClick={submit} disabled={pending} className="flex items-center justify-center gap-1.5 rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso disabled:opacity-50">
                  {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save
                </button>
                <button onClick={() => { setShowAdd(false); setError(null); }} className="rounded-lg border border-ink-line px-4 py-2 text-sm text-muted hover:text-cream">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}

      <div className="mt-4 divide-y divide-ink-line/60">
        {sorted.length === 0 && <p className="py-6 text-center text-sm text-muted">No scheduled payments yet.</p>}
        {sorted.map((p) => {
          const b = statusBadge(p);
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate text-cream">{p.label}</div>
                <div className="text-xs text-muted">
                  {p.category[0] + p.category.slice(1).toLowerCase()} · due {fmtDate(p.dueDate)}
                  {p.payee ? ` · ${p.payee}` : ""}{p.reference ? ` · ${p.method === "CHEQUE" ? "chq" : "ref"} ${p.reference}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <div className="font-semibold text-sand">{aed(p.amountAED)}</div>
                  <div className={`text-xs ${b.cls}`}>{b.text}</div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    {p.status === "PENDING" ? (
                      <button onClick={() => start(() => setScheduledPaymentPaid(p.id, true))} title="Mark paid" className="rounded-lg border border-green-500/40 bg-green-500/10 p-1.5 text-green-400 hover:bg-green-500/20"><Check size={14} /></button>
                    ) : (
                      <button onClick={() => start(() => setScheduledPaymentPaid(p.id, false))} title="Mark unpaid" className="rounded-lg border border-ink-line p-1.5 text-muted hover:text-cream"><Undo2 size={14} /></button>
                    )}
                    <button onClick={() => start(() => deleteScheduledPayment(p.id))} title="Delete" aria-label="Delete payment" className="-m-2 p-2 text-muted hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
