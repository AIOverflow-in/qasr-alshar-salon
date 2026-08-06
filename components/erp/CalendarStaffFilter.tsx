"use client";

import { useRouter } from "next/navigation";

/** Staff filter for the calendar. Navigates to ?staff=<id>, keeping the current week. */
export function CalendarStaffFilter({
  staff,
  selected,
  week,
}: {
  staff: { id: string; name: string }[];
  selected: string;
  week?: string;
}) {
  const router = useRouter();
  const go = (id: string) => {
    const p = new URLSearchParams();
    if (week) p.set("week", week);
    if (id) p.set("staff", id);
    router.push(`/erp/calendar${p.toString() ? `?${p}` : ""}`);
  };

  return (
    <select
      value={selected}
      onChange={(e) => go(e.target.value)}
      aria-label="Filter by crown artist"
      className="rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60"
    >
      <option value="">All artists</option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );
}
