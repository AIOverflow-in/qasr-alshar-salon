"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Instant client-side search + pagination for any server-rendered table(s).
 * Wrap one or more <table>s; it filters every <tbody> <tr> by visible text and
 * shows `pageSize` rows at a time with Prev/Next controls.
 */
export function TableSearch({
  placeholder = "Search…",
  pageSize = 25,
  children,
}: {
  placeholder?: string;
  pageSize?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  const apply = useCallback(() => {
    const query = q.trim().toLowerCase();
    const rows = Array.from(ref.current?.querySelectorAll("tbody tr") ?? []);
    const matches: HTMLElement[] = [];
    for (const r of rows) {
      const el = r as HTMLElement;
      if (el.querySelector("td[colspan]")) { el.style.display = ""; continue; } // keep placeholder rows
      const ok = !query || (el.textContent ?? "").toLowerCase().includes(query);
      if (ok) matches.push(el); else el.style.display = "none";
    }
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    const safePage = Math.min(page, pages - 1);
    matches.forEach((el, i) => {
      el.style.display = i >= safePage * pageSize && i < (safePage + 1) * pageSize ? "" : "none";
    });
    setMatchCount(matches.length);
    if (safePage !== page) setPage(safePage);
  }, [q, page, pageSize]);

  useEffect(() => { apply(); }, [apply]);

  const pages = Math.max(1, Math.ceil(matchCount / pageSize));

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          placeholder={placeholder}
          className="w-full rounded-full border border-ink-line bg-ink-card py-2 pl-9 pr-4 text-sm text-cream placeholder:text-muted outline-none focus:border-gold/60"
        />
      </div>

      <div ref={ref}>{children}</div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-sm text-muted">
          {matchCount === 0 ? (q ? `No matches for “${q}”.` : "No records.") : `${matchCount} result${matchCount !== 1 ? "s" : ""}`}
        </p>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-sand disabled:opacity-40 hover:border-gold/50"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-muted">Page {page + 1} of {pages}</span>
            <button
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}
              className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-sand disabled:opacity-40 hover:border-gold/50"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
