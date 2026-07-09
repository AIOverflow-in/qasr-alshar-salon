"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

function label(m: string) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Month dropdown that navigates to ?month=YYYY-MM, preserving other filters and resetting page. */
export function MonthPicker({ months, current }: { months: string[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const onChange = (m: string) => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("month", m);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Month"
      className="rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60"
    >
      {months.map((m) => <option key={m} value={m}>{label(m)}</option>)}
    </select>
  );
}
