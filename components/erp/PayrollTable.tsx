"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer, BadgeCheck, X, Wallet, Trash2 } from "lucide-react";
import { aed, cn } from "@/lib/utils";
import { addPayAdjustment, deletePayAdjustment, payStaffMonth, addStaffLoan, repayStaffLoan, applyUnpaidLeaveDeduction } from "@/lib/actions/admin";

export type PayrollRow = {
  staffId: string; name: string; role: string; clientsServed: number; servicesAED: number; grossAED: number;
  salary: number; salesCommission: number; referral: number; commission: number;
  bonus: number; deductions: number; net: number; paid: boolean; paidAt: string | null;
  adjustments: { id: string; type: string; amountAED: number; note: string | null }[];
  loans: { id: string; amountAED: number; repaidAED: number; outstandingAED: number; note: string | null }[];
  loanOutstandingAED: number;
  unpaidLeaveDays: number;
  suggestedLeaveDeductionAED: number;
};
export type PayrollTotals = { services: number; salary: number; commission: number; bonus: number; deductions: number; net: number; paidNet: number; outstandingNet: number };

function monthLabel(m: string) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function PayrollTable({ month, rows }: { month: string; rows: PayrollRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adjFor, setAdjFor] = useState<PayrollRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function pay(staffId: string) {
    const r = rows.find((x) => x.staffId === staffId);
    if (r && !window.confirm(`Mark ${r.name} paid ${aed(r.net)} for ${monthLabel(month)}?`)) return;
    setBusyId(staffId);
    start(async () => { await payStaffMonth(staffId, month); setBusyId(null); router.refresh(); });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wallet size={18} className="text-gold" />
        <h2 className="font-display text-xl text-cream">Payslip detail</h2>
        <span className="text-xs text-muted">{monthLabel(month)}</span>
      </div>

      {/* The pay rule, stated where the numbers are read. Without it "Earned" looks like a mistake:
          an artist with a salary shows commission far below 40% of their services, because the
          salary floor is what actually paid them. */}
      <div className="surface mb-4 rounded-2xl border-l-2 border-gold p-4">
        <p className="text-sm text-cream">
          <span className="font-semibold">How pay is worked out:</span> each artist earns the{" "}
          <span className="text-gold">higher</span> of their base salary or their sales commission —
          never both added together.
        </p>
        <p className="mt-1.5 text-xs text-muted">
          Referral and bonus are always added on top; advances and deductions come off. Commission is
          a % of the service value <span className="text-sand">after VAT is removed</span>, so it
          works out near 38% of what the client actually paid, not 40%. An artist on 0% commission
          earns their salary only.
        </p>
      </div>

      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="border-b border-ink-line text-left text-muted">
            <tr>
              <th className="p-4 font-medium">Staff</th>
              <th className="p-4 text-right font-medium">Clients</th>
              <th className="p-4 text-right font-medium">Services</th>
              <th className="p-4 text-right font-medium">Earned</th>
              <th className="p-4 text-right font-medium">Referral</th>
              <th className="p-4 text-right font-medium">Bonus</th>
              <th className="p-4 text-right font-medium">Adv./Ded.</th>
              <th className="p-4 text-right font-medium">Net pay</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line/60">
            {rows.map((r) => {
              const earned = Math.max(r.salesCommission, r.salary); // base is a floor: commission only if it beats base
              return (
              <tr key={r.staffId} className={cn(busyId === r.staffId && "opacity-50")}>
                <td className="p-4">
                  <div className="text-cream">{r.name}</div>
                  <div className="text-xs text-muted">{r.role}</div>
                </td>
                <td className="p-4 text-right tabular-nums text-sand" title="Distinct clients served this month">{r.clientsServed || "—"}</td>
                <td className="p-4 text-right tabular-nums text-sand" title="Net service revenue this person generated (ex-VAT)">{r.servicesAED ? aed(r.servicesAED) : "—"}</td>
                <td className="p-4 text-right tabular-nums text-sand" title={`Base salary ${aed(r.salary)} vs sales commission ${aed(r.salesCommission)} — the higher is paid`}>
                  {earned ? aed(earned) : "—"}
                  {earned > 0 && <span className="block text-[0.6rem] text-muted">{r.salesCommission >= r.salary ? "commission" : "base floor"}</span>}
                </td>
                <td className="p-4 text-right tabular-nums text-sand" title="Referral (marketer) — always added on top">{r.referral ? aed(r.referral) : "—"}</td>
                <td className="p-4 text-right tabular-nums text-green-400">{r.bonus ? aed(r.bonus) : "—"}</td>
                <td className="p-4 text-right tabular-nums text-red-600">{r.deductions ? `−${aed(r.deductions)}` : "—"}</td>
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
                    {!r.paid && r.net > 0 && (
                      <button onClick={() => pay(r.staffId)} disabled={pending} className="rounded-lg bg-gold-gradient px-2.5 py-1 text-xs font-semibold text-espresso disabled:opacity-40">Pay</button>
                    )}
                  </div>
                </td>
              </tr>
              ); })}
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
          {error && <p className="rounded-lg border border-red-500/40 bg-red-50 p-2 text-xs text-red-600">{error}</p>}
          <button onClick={submit} disabled={pending} className="w-full rounded-lg bg-gold-gradient py-2 text-sm font-semibold text-espresso disabled:opacity-50">
            {pending ? "Saving…" : "Add adjustment"}
          </button>

          {/* Unpaid leave — suggested, never applied automatically. */}
          {row.suggestedLeaveDeductionAED > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <div className="text-xs text-cream">
                {row.unpaidLeaveDays} day{row.unpaidLeaveDays === 1 ? "" : "s"} unpaid leave this month
                <span className="block text-[0.65rem] text-muted">= {aed(row.suggestedLeaveDeductionAED)} at {aed(Math.round(row.salary / 30))}/day</span>
              </div>
              <button
                onClick={() => { setError(null); start(async () => {
                  try { await applyUnpaidLeaveDeduction(row.staffId, month, row.suggestedLeaveDeductionAED, row.unpaidLeaveDays); onDone(); }
                  catch (e) { setError(e instanceof Error ? e.message : "Could not apply."); }
                }); }}
                disabled={pending}
                className="mt-2 w-full rounded-lg border border-amber-500/50 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-500/10 disabled:opacity-50"
              >
                Apply this deduction
              </button>
            </div>
          )}

          {/* Loans — outstanding balance and a repayment taken from this month's pay. */}
          <div className="rounded-lg border border-ink-line p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Loans outstanding</span>
              <span className="text-xs font-semibold text-cream">{row.loanOutstandingAED ? aed(row.loanOutstandingAED) : "none"}</span>
            </div>
            {row.loans.map((l) => (
              <div key={l.id} className="mt-2 flex items-center justify-between gap-2 border-t border-ink-line/60 pt-2">
                <div className="min-w-0 text-[0.65rem] text-muted">
                  <span className="text-cream">{aed(l.outstandingAED)}</span> left of {aed(l.amountAED)}
                  {l.note && <div className="truncate" title={l.note}>{l.note}</div>}
                </div>
                <button
                  onClick={() => {
                    const raw = window.prompt(`Deduct how much from ${row.name}'s ${month} pay?`, String(Math.min(l.outstandingAED, Math.max(0, row.net))));
                    if (!raw) return;
                    setError(null);
                    start(async () => {
                      try { await repayStaffLoan(l.id, month, parseInt(raw) || 0); onDone(); }
                      catch (e) { setError(e instanceof Error ? e.message : "Could not record repayment."); }
                    });
                  }}
                  disabled={pending}
                  className="shrink-0 rounded-md border border-ink-line px-2 py-1 text-[0.65rem] text-sand hover:border-gold/50 hover:text-gold disabled:opacity-50"
                >
                  Deduct
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const raw = window.prompt(`New loan for ${row.name} — amount in AED?`);
                if (!raw) return;
                const note = window.prompt("Note (optional)") || null;
                setError(null);
                start(async () => {
                  try { await addStaffLoan(row.staffId, parseInt(raw) || 0, note); onDone(); }
                  catch (e) { setError(e instanceof Error ? e.message : "Could not add loan."); }
                });
              }}
              disabled={pending}
              className="mt-2 w-full rounded-lg border border-ink-line py-1.5 text-[0.65rem] text-sand hover:border-gold/50 hover:text-gold disabled:opacity-50"
            >
              + Record a loan
            </button>
          </div>

          {/* Existing entries — without this, a mistaken adjustment could never be undone. */}
          {row.adjustments.length > 0 && (
            <div className="border-t border-ink-line pt-3">
              <div className="mb-1.5 text-[0.65rem] uppercase tracking-wider text-muted">This month&apos;s adjustments</div>
              <ul className="space-y-1.5">
                {row.adjustments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-line px-2.5 py-1.5">
                    <div className="min-w-0">
                      <span className={cn("text-xs font-semibold", a.type === "BONUS" ? "text-green-600" : "text-red-600")}>
                        {a.type === "BONUS" ? "+" : "−"} {aed(a.amountAED)}
                      </span>
                      <span className="ml-1.5 text-[0.65rem] capitalize text-muted">{a.type.toLowerCase()}</span>
                      {a.note && <div className="truncate text-[0.65rem] text-muted" title={a.note}>{a.note}</div>}
                    </div>
                    <button
                      onClick={() => {
                        if (!confirm(`Remove this ${a.type.toLowerCase()} of ${aed(a.amountAED)} from ${row.name}'s ${month} pay?`)) return;
                        setError(null);
                        start(async () => {
                          try { await deletePayAdjustment(a.id); onDone(); }
                          catch (e) { setError(e instanceof Error ? e.message : "Could not remove."); }
                        });
                      }}
                      disabled={pending}
                      className="shrink-0 rounded-md border border-ink-line p-1 text-muted hover:border-red-400/60 hover:text-red-600 disabled:opacity-50"
                      aria-label="Remove adjustment"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
              {row.paid && (
                <p className="mt-2 text-[0.65rem] text-gold">
                  Already marked paid — after changing an adjustment, click Pay again so the payslip updates.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
