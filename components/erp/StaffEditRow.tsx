"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { updateStaff } from "@/lib/actions/admin";
import { aed, cn } from "@/lib/utils";

type Props = {
  id: string;
  name: string;
  role: string;
  hours: string;
  offDay: string | null;
  phone: string | null;
  salaryAED: number;
  commissionPct: number;
  referralPct: number;
  joinedOn: string | null;
  active: boolean;
};

/**
 * One artist's pay configuration.
 *
 * Read first, edit on purpose: the row shows the salary and split as plain text so a manager can
 * scan the whole team's pay in one pass, and only becomes a form once Edit is pressed. Previously
 * every field on every row was a live input — a wall of boxes that was hard to read, easy to change
 * by accident, and invisible to the table search (input values are not page text).
 */
export function StaffEditRow(props: Props) {
  const { id, name, role, hours, offDay, phone, salaryAED, commissionPct, referralPct, joinedOn, active } = props;

  const [editing, setEditing] = useState(false);
  const [r, setR] = useState(role);
  const [h, setH] = useState(hours);
  const [off, setOff] = useState(offDay ?? "");
  const [ph, setPh] = useState(phone ?? "");
  const [sal, setSal] = useState(salaryAED);
  const [comm, setComm] = useState(commissionPct);
  const [ref, setRef] = useState(referralPct);
  const [joined, setJoined] = useState(joinedOn ?? "");
  const [isActive, setIsActive] = useState(active);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const dirty =
    r !== role || h !== hours || off !== (offDay ?? "") || ph !== (phone ?? "") || sal !== salaryAED ||
    comm !== commissionPct || ref !== referralPct || joined !== (joinedOn ?? "") || isActive !== active;

  function reset() {
    setR(role); setH(hours); setOff(offDay ?? ""); setPh(phone ?? ""); setSal(salaryAED);
    setComm(commissionPct); setRef(referralPct); setJoined(joinedOn ?? ""); setIsActive(active);
  }

  function save() {
    start(async () => {
      await updateStaff(id, { role: r, hours: h, offDay: off, phone: ph, salaryAED: sal, commissionPct: comm, referralPct: ref, joinedOn: joined || null, active: isActive });
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 1800);
    });
  }

  const input = "rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-cream outline-none focus:border-gold/60";

  // ---- Reading mode: the whole team's pay, scannable ----
  if (!editing) {
    return (
      <tr className={cn("group", !active && "opacity-55")}>
        <td className="p-3">
          <Link href={`/erp/staff/${id}`} className="font-medium text-cream hover:text-gold hover:underline" title="View work performed, times & invoices">
            {name}
          </Link>
          <div className="text-xs text-muted">{role || "—"}</div>
        </td>

        <td className="p-3 text-xs text-muted">
          <div className="text-sand">{hours || "—"}</div>
          <div>{offDay ? `Off ${offDay}` : "No off day set"}</div>
        </td>

        <td className="p-3 text-right">
          {salaryAED > 0
            ? <span className="tabular-nums text-cream">{aed(salaryAED)}</span>
            : <span className="text-xs text-muted">Commission only</span>}
        </td>

        <td className="p-3 text-right text-sm">
          <span className="tabular-nums text-sand">{commissionPct}%</span>
          {referralPct > 0 && <span className="ml-1.5 text-xs text-muted">+{referralPct}% ref</span>}
        </td>

        <td className="p-3">
          <span className={cn(
            "rounded-full border px-2.5 py-1 text-xs",
            active ? "border-green-500/40 text-green-400" : "border-muted/40 text-muted"
          )}>
            {active ? "Active" : "Inactive"}
          </span>
        </td>

        <td className="p-3 text-right">
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line px-2.5 py-1.5 text-xs text-sand hover:border-gold/50 hover:text-gold"
          >
            {saved ? <><Check size={13} className="text-green-400" /> Saved</> : <><Pencil size={12} /> Edit</>}
          </button>
        </td>
      </tr>
    );
  }

  // ---- Editing mode: the full record for this one person ----
  return (
    <tr className={cn("bg-gold/5", pending && "opacity-60")}>
      <td className="p-3 align-top">
        <div className="font-medium text-cream">{name}</div>
        <input value={r} onChange={(e) => setR(e.target.value)} placeholder="Role" className={cn(input, "mt-1.5 w-36 text-xs")} />
      </td>

      <td className="p-3 align-top">
        <div className="flex flex-col gap-1.5">
          <input value={h} onChange={(e) => setH(e.target.value)} placeholder="Hours" className={cn(input, "w-40 text-xs")} />
          <input value={off} onChange={(e) => setOff(e.target.value)} placeholder="Off day" className={cn(input, "w-40 text-xs")} />
          <input type="date" value={joined} onChange={(e) => setJoined(e.target.value)} className={cn(input, "w-40 text-xs")} title="Joining date — drives leave entitlement" />
          <input value={ph} onChange={(e) => setPh(e.target.value)} placeholder="+9715…" className={cn(input, "w-40 text-xs")} title="Phone for WhatsApp booking reminders" />
        </div>
      </td>

      <td className="p-3 align-top text-right">
        <input
          type="number" value={sal} min={0} step={100}
          onChange={(e) => setSal(Number(e.target.value))}
          className={cn(input, "w-28 text-right text-sm")}
          title="Base monthly salary — a FLOOR, not an addition. They are paid the higher of this or their sales commission. 0 = commission-only."
        />
        <div className="mt-1 text-[0.6rem] text-muted">0 = commission only</div>
      </td>

      <td className="p-3 align-top">
        <div className="flex items-center justify-end gap-1 text-xs text-muted">
          <input
            type="number" value={comm} min={0} max={100}
            onChange={(e) => setComm(Number(e.target.value))}
            className={cn(input, "w-14 text-center")}
            title="Share of the ex-VAT service value. Paid only when it beats the base salary. Setting this to 0 means this person can only ever earn their salary."
          />%
          <span className="mx-0.5 text-ink-line">·</span>
          <input type="number" value={ref} min={0} max={100} onChange={(e) => setRef(Number(e.target.value))} className={cn(input, "w-12 text-center")} />% ref
        </div>
      </td>

      <td className="p-3 align-top">
        <button
          onClick={() => setIsActive((v) => !v)}
          className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", isActive ? "border-green-500/40 text-green-400" : "border-muted/40 text-muted")}
        >
          {isActive ? "Active" : "Inactive"}
        </button>
      </td>

      <td className="p-3 align-top">
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => { reset(); setEditing(false); }}
            disabled={pending}
            className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-muted hover:border-red-400/60 hover:text-red-400 disabled:opacity-40"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
          <button
            onClick={save}
            disabled={!dirty || pending}
            className="flex items-center gap-1 rounded-lg bg-gold-gradient px-3 py-1.5 text-xs font-semibold text-espresso disabled:opacity-40"
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : null}
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </td>
    </tr>
  );
}
