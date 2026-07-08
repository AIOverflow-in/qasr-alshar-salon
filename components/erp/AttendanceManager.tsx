"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Loader2, Check } from "lucide-react";
import { setStaffBiometricPin } from "@/lib/actions/admin";

type Punch = { id: string; pin: string; punchedAt: string; status: string | null; verifyMode: string | null; staffName: string | null };
type Staff = { id: string; name: string; pin: string | null };

const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));

export function AttendanceManager({ punches, staff, unmappedPins }: { punches: Punch[]; staff: Staff[]; unmappedPins: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pins, setPins] = useState<Record<string, string>>(Object.fromEntries(staff.map((s) => [s.id, s.pin ?? ""])));

  function savePin(staffId: string) {
    start(async () => { await setStaffBiometricPin(staffId, pins[staffId] ?? ""); router.refresh(); });
  }

  return (
    <div className="space-y-6">
      {unmappedPins.length > 0 && (
        <div className="surface rounded-2xl border border-gold/30 p-4">
          <div className="text-sm text-gold">Unmapped device IDs: {unmappedPins.join(", ")}</div>
          <p className="mt-1 text-xs text-muted">These PINs have punched in but aren&apos;t linked to a staff member yet. Set the matching PIN in the table below and their punches attach automatically.</p>
        </div>
      )}

      {/* staff ↔ device PIN mapping */}
      <div className="surface rounded-2xl p-5">
        <h2 className="font-display text-lg text-cream">Staff device IDs</h2>
        <p className="text-xs text-muted">Enter each staff member&apos;s user ID on the fingerprint terminal so their punches are recognised.</p>
        <div className="mt-3 divide-y divide-ink-line/60">
          {staff.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 truncate text-sm text-cream">{s.name}</div>
              <input
                value={pins[s.id] ?? ""}
                onChange={(e) => setPins((p) => ({ ...p, [s.id]: e.target.value }))}
                placeholder="Device PIN"
                className="w-28 rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-sm text-cream outline-none focus:border-gold/60"
              />
              <button onClick={() => savePin(s.id)} disabled={pending || (pins[s.id] ?? "") === (s.pin ?? "")} className="rounded-lg border border-gold/40 px-2.5 py-1.5 text-xs text-gold hover:bg-gold/10 disabled:opacity-40">
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* punch log */}
      <div className="surface rounded-2xl p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-cream"><Fingerprint size={17} className="text-gold" /> Recent punches</h2>
        <div className="mt-3 divide-y divide-ink-line/60">
          {punches.length === 0 && <p className="py-8 text-center text-sm text-muted">No punches yet. Once the terminal is pointed at us, scans appear here in real time.</p>}
          {punches.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="text-cream">{p.staffName ?? <span className="text-muted">PIN {p.pin} <span className="text-[0.6rem] text-gold">unmapped</span></span>}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted">{p.verifyMode === "1" ? "👆" : ""}{p.status ? ` #${p.status}` : ""}</span>
                <span className="text-sand">{fmt(p.punchedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
