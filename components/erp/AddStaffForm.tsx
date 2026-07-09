"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2 } from "lucide-react";
import { createStaff } from "@/lib/actions/admin";

const input = "rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60";
const EMPTY = { name: "", role: "", phone: "", salaryAED: "", commissionPct: "40", referralPct: "5", joinedOn: "" };

/**
 * Onboard a new staff member from the Staff & Payroll page — a toggle button
 * that reveals a name/role/pay form. Creating a staff member makes them
 * bookable and eligible for commissions + monthly payroll immediately.
 */
export function AddStaffForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState<string | null>(null);

  function add() {
    setErr(null);
    if (!f.name.trim()) { setErr("Enter the staff member's name."); return; }
    start(async () => {
      const res = await createStaff({
        name: f.name,
        role: f.role,
        phone: f.phone,
        salaryAED: f.salaryAED === "" ? undefined : Number(f.salaryAED),
        commissionPct: f.commissionPct === "" ? undefined : Number(f.commissionPct),
        referralPct: f.referralPct === "" ? undefined : Number(f.referralPct),
        joinedOn: f.joinedOn || null,
      });
      if (!res?.ok) { setErr(res?.error ?? "Could not add staff."); return; }
      setF(EMPTY);
      setAdding(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setAdding((v) => !v); setErr(null); }} className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso">
          <UserPlus size={15} /> {adding ? "Cancel" : "Add staff"}
        </button>
      </div>

      {adding && (
        <div className="surface rounded-2xl p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <input className={input} placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
            <input className={input} placeholder="Role (e.g. Hair Stylist)" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} />
            <input className={input} placeholder="Phone (+9715…)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <label className="flex items-center gap-2 text-xs text-muted">
              <span className="w-24 shrink-0">Salary AED/mo</span>
              <input className={`${input} w-full`} type="number" min={0} step={100} placeholder="0 = commission-only" value={f.salaryAED} onChange={(e) => setF({ ...f, salaryAED: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted">
              <span className="w-24 shrink-0">Commission %</span>
              <input className={`${input} w-full`} type="number" min={0} max={100} value={f.commissionPct} onChange={(e) => setF({ ...f, commissionPct: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted">
              <span className="w-24 shrink-0">Referral %</span>
              <input className={`${input} w-full`} type="number" min={0} max={100} value={f.referralPct} onChange={(e) => setF({ ...f, referralPct: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2 lg:col-span-1">
              <span className="w-24 shrink-0">Joined on</span>
              <input className={`${input} w-full [color-scheme:dark]`} type="date" value={f.joinedOn} onChange={(e) => setF({ ...f, joinedOn: e.target.value })} title="Hire date — drives annual-leave entitlement" />
            </label>
          </div>
          {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
          <button onClick={add} disabled={pending} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso disabled:opacity-50">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} {pending ? "Adding…" : "Create staff"}
          </button>
          <p className="mt-2 text-xs text-muted">Defaults: Crown Artist · 40% commission · 5% referral · salary 0 (commission-only). Edit any of these in the table below after adding.</p>
        </div>
      )}
    </div>
  );
}
