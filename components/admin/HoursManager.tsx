"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  updateWorkingHours,
  updateSettings,
  addBlockedSlot,
  removeBlockedSlot,
} from "@/lib/actions/admin";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Hours = { weekday: number; open: string; close: string; closed: boolean };
type Settings = { capacity: number; slotMinutes: number; leadTimeMinutes: number; maxAdvanceDays: number };
type Block = { id: string; startAt: string; endAt: string; reason: string | null };

export function HoursManager({
  hours,
  settings,
  blocks,
}: {
  hours: Hours[];
  settings: Settings;
  blocks: Block[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <WorkingHoursCard hours={hours} />
      <div className="space-y-6">
        <SettingsCard settings={settings} />
        <BlockedSlotsCard blocks={blocks} />
      </div>
    </div>
  );
}

function WorkingHoursCard({ hours }: { hours: Hours[] }) {
  const [rows, setRows] = useState(hours);
  const [pending, start] = useTransition();
  const [savedDay, setSavedDay] = useState<number | null>(null);

  function save(weekday: number) {
    const row = rows.find((r) => r.weekday === weekday)!;
    start(async () => {
      await updateWorkingHours(weekday, { open: row.open, close: row.close, closed: row.closed });
      setSavedDay(weekday);
      setTimeout(() => setSavedDay(null), 1200);
    });
  }

  function update(weekday: number, patch: Partial<Hours>) {
    setRows((rs) => rs.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));
  }

  return (
    <div className="surface rounded-2xl p-5">
      <h2 className="mb-4 font-display text-xl text-gold">Opening Hours</h2>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.weekday} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24 text-sand">{WEEKDAYS[r.weekday]}</span>
            <input
              type="time"
              value={r.open}
              disabled={r.closed}
              onChange={(e) => update(r.weekday, { open: e.target.value })}
              className="rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-cream outline-none focus:border-gold/60 disabled:opacity-40"
            />
            <span className="text-muted">–</span>
            <input
              type="time"
              value={r.close}
              disabled={r.closed}
              onChange={(e) => update(r.weekday, { close: e.target.value })}
              className="rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-cream outline-none focus:border-gold/60 disabled:opacity-40"
            />
            <button
              onClick={() => update(r.weekday, { closed: !r.closed })}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                r.closed ? "border-red-500/40 text-red-400" : "border-green-500/40 text-green-400"
              }`}
            >
              {r.closed ? "Closed" : "Open"}
            </button>
            <button
              onClick={() => save(r.weekday)}
              disabled={pending}
              className="ml-auto rounded-lg bg-gold-gradient px-3 py-1 text-xs font-semibold text-ink"
            >
              {savedDay === r.weekday ? "Saved" : "Save"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsCard({ settings }: { settings: Settings }) {
  const [s, setS] = useState(settings);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const fields: { key: keyof Settings; label: string; hint: string }[] = [
    { key: "capacity", label: "Concurrent capacity", hint: "stations / staff working at once" },
    { key: "slotMinutes", label: "Slot interval (min)", hint: "granularity of bookable times" },
    { key: "leadTimeMinutes", label: "Lead time (min)", hint: "min notice before a booking" },
    { key: "maxAdvanceDays", label: "Max advance (days)", hint: "how far ahead clients can book" },
  ];

  function save() {
    start(async () => {
      await updateSettings(s);
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    });
  }

  return (
    <div className="surface rounded-2xl p-5">
      <h2 className="mb-4 font-display text-xl text-gold">Booking Settings</h2>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <label key={f.key} className="text-xs text-muted">
            {f.label}
            <input
              type="number"
              value={s[f.key]}
              onChange={(e) => setS({ ...s, [f.key]: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-cream outline-none focus:border-gold/60"
            />
            <span className="mt-0.5 block text-[0.65rem] text-muted/70">{f.hint}</span>
          </label>
        ))}
      </div>
      <button
        onClick={save}
        disabled={pending}
        className="mt-4 flex items-center gap-1.5 rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-ink"
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        {saved ? "Saved" : "Save Settings"}
      </button>
    </div>
  );
}

function BlockedSlotsCard({ blocks }: { blocks: Block[] }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function fmt(iso: string) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dubai",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  }

  function add() {
    if (!start || !end) return;
    // datetime-local is interpreted as Dubai wall-clock
    const startISO = new Date(`${start}:00+04:00`).toISOString();
    const endISO = new Date(`${end}:00+04:00`).toISOString();
    startTransition(async () => {
      await addBlockedSlot(startISO, endISO, reason);
      setStart("");
      setEnd("");
      setReason("");
    });
  }

  return (
    <div className="surface rounded-2xl p-5">
      <h2 className="mb-4 font-display text-xl text-gold">Blocked Dates</h2>
      <div className="space-y-2">
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-full rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-sm text-cream outline-none focus:border-gold/60"
        />
        <input
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="w-full rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-sm text-cream outline-none focus:border-gold/60"
        />
        <input
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-sm text-cream outline-none placeholder:text-muted focus:border-gold/60"
        />
        <button
          onClick={add}
          disabled={pending || !start || !end}
          className="flex items-center gap-1.5 rounded-lg bg-gold-gradient px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
        >
          <Plus size={14} /> Block this window
        </button>
      </div>

      {blocks.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-line px-3 py-2">
              <span className="text-sand">
                {fmt(b.startAt)} → {fmt(b.endAt)}
                {b.reason && <span className="text-muted"> · {b.reason}</span>}
              </span>
              <form action={removeBlockedSlot.bind(null, b.id)}>
                <button className="text-muted hover:text-red-400">
                  <Trash2 size={15} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
