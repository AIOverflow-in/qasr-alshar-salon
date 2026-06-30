"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Printer, BadgeCheck, X, Wallet } from "lucide-react";
import { aed, cn } from "@/lib/utils";
import { addPayAdjustment, payStaffMonth } from "@/lib/actions/admin";

export type PayrollRow = {
  staffId: string; name: string; role: string;
  salary: number; salesCommission: number; referral: number; commission: number;
  bonus: number; deductions: number; net: number; paid: boolean; paidAt: string | null;
};
export type PayrollTotals = { salary: number; commission: number; bonus: number; deductions: number; net: number; paidNet: number; outstandingNet: number };

function monthLabel(m: string) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function PayrollTable({ month, months, rows, totals }: { month: string; months: string[]; rows: PayrollRow[]; totals: PayrollTotals }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adjFor, setAdjFor] = useState<PayrollRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function pay(staffId: string) {
    setBusyId(staffId);
    start(async () => { await payStaffMonth(staffId, month); setBusyId(null); router.refresh(); });
  }
  function payAll() {
    const due = rows.filter((r) => !r.paid && r.net !== 0);
    if (!due.length) return;
    start(async () => { for (const r of due) await payStaffMonth(r.staffId, month); router.refresh(); });
  }

  const cards = [
    { label: "Salary bill", value: aed(totals.salary) },
    { label: "Commission", value: aed(totals.commission) },
    { label: "Net payroll", value: aed(totals.net), accent: true },
    { label: "Outstanding", value: aed(totals.outstandingNet) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-gold" />
          <h2 className="font-display text-xl text-cream">Monthly Payroll</h2>
          <select
            value={month}
            onChange={(e) => router.push(`/erp/staff?month=${e.target.value}`)}
            className="rounded-lg border border-ink-line bg-ink-card px-3 py-1.5 text-sm text-cream outline-none focus:border-gold/60"
          >
            {months.map((m) => <option key={m} value={m} className="bg-ink">{monthLabel(m)}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/erp/payroll/export?month=${month}`} className="rounded-full border border-ink-line px-4 py-1.5 text-sm text-sand hover:border-gold/50 hover:text-gold">Export CSV</a>
          <button onClick={payAll} disabled={pending || totals.outstandingNet === 0} className="rounded-full bg-gold-gradient px-4 py-1.5 text-sm font-semibold text-espresso disabled:opacity-40">
            {pending ? <Loader2 className="inline animate-spin" size={14} /> : null} Pay all due
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="surface rounded-2xl p-4">
            <div className={cn("font-display text-2xl", c.accent ? "text-gold-gradient" : "text-cream")}>{c.value}</div>
            <div className="text-xs uppercase tracking-wider text-muted">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="border-b border-ink-line text-left text-muted">
            <tr>
              <th className="p-4 font-medium">Staff</th>
              <th className="p-4 text-right font-medium">Salary</th>
              <th className="p-4 text-right font-medium">Commission</th>
              <th className="p-4 text-right font-medium">Bonus</th>
              <th className="p-4 text-right font-medium">Adv./Ded.</th>
              <th className="p-4 text-right font-medium">Net pay</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line/60">
            {rows.map((r) => (
              <tr key={r.staffId} className={cn(busyId === r.staffId && "opacity-50")}>
                <td className="p-4">
                  <div className="text-cream">{r.name}</div>
                  <div className="text-xs text-muted">{r.role}</div>
                </td>
                <td className="p-4 text-right tabular-nums text-sand">{r.salary ? aed(r.salary) : "—"}</td>
                <td className="p-4 text-right tabular-nums text-sand" title={`Sales ${aed(r.salesCommission)} · Referral ${aed(r.referral)}`}>{r.commission ? aed(r.commission) : "—"}</td>
                <td className="p-4 text-right tabular-nums text-green-400">{r.bonus ? aed(r.bonus) : "—"}</td>
                <td className="p-4 text-right tabular-nums text-red-400">{r.deductions ? `−${aed(r.deductions)}` : "—"}</td>
                <td className="p-4 text-right font-semibold tabular-nums text-cream">{aed(r.net)}</td>
                <td className="p-4">
                  {r.paid
                    ? <span className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-0.5 text-xs text-green-400"><BadgeCheck size={12} /> Paid</span>
                    : <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-xs text-gold">Due</span>}
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setAdjFor(r)} className="inline-flex items-center gap-1 rounded-lg border border-ink-line px-2 py-1 text-xs text-sand hover:border-gold/50 hover:text-gold" title="Add bonus / advance / deduction">
                      <Plus size={12} /> Adjust
                    </button>
                    <a href={`/api/erp/payroll/payslip/${r.staffId}?month=${month}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gold/40 px-2 py-1 text-xs text-gold hover:bg-gold/10" title="Payslip PDF">
                      <Printer size={12} /> Slip
                    </a>
                    {!r.paid && r.net !== 0 && (
                      <button onClick={() => pay(r.staffId)} disabled={pending} className="rounded-lg bg-gold-gradient px-2.5 py-1 text-xs font-semibold text-espresso disabled:opacity-40">Pay</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adjFor && <AdjustModal row={adjFor} month={month} onClose={() => setAdjFor(null)} onDone={() => { setAdjFor(null); router.refresh(); }} />}
    </div>
  );
}

function AdjustModal({ row, month, onClose, onDone }: { row: PayrollRow; month: string; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<"BONUS" | "ADVANCE" | "DEDUCTION">("BONUS");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const amt = parseInt(amount);
    if (!amt || amt <= 0) { setError("Enter an amount."); return; }
    setError(null);
    start(async () => {
      try { await addPayAdjustment(row.staffId, month, type, amt, note || null); onDone(); }
      catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="surface w-full max-w-sm rounded-2xl border border-ink-line p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-cream">Adjust pay · {row.name}</h3>
          <button onClick={onClose} className="text-muted hover:text-cream"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="flex gap-1.5">
            {(["BONUS", "ADVANCE", "DEDUCTION"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)} className={cn("flex-1 rounded-lg border py-2 text-xs font-semibold capitalize", type === t ? "border-gold bg-gold/15 text-gold" : "border-ink-line text-muted hover:border-gold/40")}>
                {t.toLowerCase()}
              </button>
            ))}
          </div>
          <input type="number" value={amount} min={1} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (AED)" className="w-full rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60" />
          <p className="text-xs text-muted">{type === "BONUS" ? "Adds to" : "Subtracts from"} {row.name}&apos;s net pay for {month}.</p>
          {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">{error}</p>}
          <button onClick={submit} disabled={pending} className="w-full rounded-lg bg-gold-gradient py-2 text-sm font-semibold text-espresso disabled:opacity-50">
            {pending ? "Saving…" : "Add adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
}
