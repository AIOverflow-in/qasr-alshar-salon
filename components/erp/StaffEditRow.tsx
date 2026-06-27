"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, BadgeCheck } from "lucide-react";
import { updateStaff, settleCommissions } from "@/lib/actions/admin";
import { cn, aed } from "@/lib/utils";

export function StaffEditRow({
  id,
  name,
  role,
  hours,
  offDay,
  commissionPct,
  referralPct,
  active,
  bookingsMTD,
  earnedMTD,
}: {
  id: string;
  name: string;
  role: string;
  hours: string;
  offDay: string | null;
  commissionPct: number;
  referralPct: number;
  active: boolean;
  bookingsMTD: number;
  earnedMTD: number;
}) {
  const [r, setR] = useState(role);
  const [h, setH] = useState(hours);
  const [off, setOff] = useState(offDay ?? "");
  const [comm, setComm] = useState(commissionPct);
  const [ref, setRef] = useState(referralPct);
  const [isActive, setIsActive] = useState(active);
  const [pending, start] = useTransition();
  const [settling, startSettle] = useTransition();
  const [saved, setSaved] = useState(false);

  const dirty =
    r !== role || h !== hours || off !== (offDay ?? "") || comm !== commissionPct || ref !== referralPct || isActive !== active;

  function save() {
    start(async () => {
      await updateStaff(id, { role: r, hours: h, offDay: off, commissionPct: comm, referralPct: ref, active: isActive });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  const input = "rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-cream outline-none focus:border-gold/60";

  return (
    <tr className={cn(pending && "opacity-60")}>
      <td className="p-3 font-medium text-cream">{name}</td>
      <td className="p-3">
        <input value={r} onChange={(e) => setR(e.target.value)} className={cn(input, "w-32 text-sm")} />
      </td>
      <td className="p-3">
        <input value={h} onChange={(e) => setH(e.target.value)} className={cn(input, "w-36 text-xs")} />
      </td>
      <td className="p-3">
        <input value={off} onChange={(e) => setOff(e.target.value)} placeholder="—" className={cn(input, "w-24 text-sm")} />
      </td>
      <td className="p-3 text-right text-sand">{bookingsMTD}</td>
      <td className="p-3">
        <div className="flex items-center gap-1 text-xs text-muted">
          <input type="number" value={comm} min={0} max={100} onChange={(e) => setComm(Number(e.target.value))} className={cn(input, "w-14 text-center")} />%
          <span className="mx-1 text-ink-line">·</span>
          <input type="number" value={ref} min={0} max={100} onChange={(e) => setRef(Number(e.target.value))} className={cn(input, "w-12 text-center")} />% ref
        </div>
      </td>
      <td className="p-3 text-right">
        <div className="font-semibold text-gold">{earnedMTD ? aed(earnedMTD) : "—"}</div>
        {earnedMTD > 0 && (
          <button
            onClick={() => startSettle(() => settleCommissions(id))}
            disabled={settling}
            className="mt-0.5 inline-flex items-center gap-1 text-[0.65rem] text-muted hover:text-green-400"
            title="Mark this month's commissions as paid"
          >
            {settling ? <Loader2 size={10} className="animate-spin" /> : <BadgeCheck size={10} />} settle
          </button>
        )}
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsActive((v) => !v)}
            className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", isActive ? "border-green-500/40 text-green-400" : "border-muted/40 text-muted")}
          >
            {isActive ? "Active" : "Inactive"}
          </button>
          <button
            onClick={save}
            disabled={!dirty || pending}
            className="flex items-center gap-1 rounded-lg bg-gold-gradient px-2.5 py-1.5 text-xs font-semibold text-espresso disabled:opacity-40"
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : null}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </td>
    </tr>
  );
}
