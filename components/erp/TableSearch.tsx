"use client";

import { useRef, useState } from "react";
import { Search } from "lucide-react";

/**
 * Instant client-side search for any server-rendered table(s).
 * Wrap one or more <table>s; it filters every <tbody> <tr> by visible text.
 * Zero refetch, works for small or large lists.
 */
export function TableSearch({
  placeholder = "Search…",
  children,
}: {
  placeholder?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [empty, setEmpty] = useState(false);

  function onChange(value: string) {
    setQ(value);
    const query = value.trim().toLowerCase();
    const rows = ref.current?.querySelectorAll("tbody tr") ?? [];
    let shown = 0;
    rows.forEach((r) => {
      // Skip placeholder/empty-state rows (single cell spanning the table).
      const isPlaceholder = r.querySelector("td[colspan]") !== null;
      const match = !query || (r.textContent ?? "").toLowerCase().includes(query);
      (r as HTMLElement).style.display = match || isPlaceholder ? "" : "none";
      if (match && !isPlaceholder) shown++;
    });
    setEmpty(query.length > 0 && shown === 0);
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-full border border-ink-line bg-ink-card py-2 pl-9 pr-4 text-sm text-cream placeholder:text-muted outline-none focus:border-gold/60"
        />
      </div>
      <div ref={ref}>{children}</div>
      {empty && <p className="px-1 text-sm text-muted">No matches for “{q}”.</p>}
    </div>
  );
}
