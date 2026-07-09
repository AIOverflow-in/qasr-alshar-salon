"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Server-side pagination control. Renders "from–to of total" + Prev/Next as links
 * that set `?page=N` while preserving every other query param (filters, search,
 * month, when…). The page reads `page` from searchParams and fetches only that
 * slice, so nothing is ever silently dropped. Hidden when there's a single page.
 */
export function Pagination({ total, page, size, param = "page" }: { total: number; page: number; size: number; param?: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (current - 1) * size + 1;
  const to = Math.min(current * size, total);

  const href = (p: number) => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (p <= 1) params.delete(param);
    else params.set(param, String(p));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  if (pages <= 1) {
    return total > 0 ? (
      <div className="mt-3 text-xs text-muted">{total} {total === 1 ? "row" : "rows"}</div>
    ) : null;
  }

  const btn = "grid h-9 w-9 place-items-center rounded-lg border border-ink-line text-sand hover:border-gold/50 hover:text-gold";
  const disabled = "pointer-events-none opacity-40";

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-muted">
      <span className="tabular-nums">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Link
          href={href(current - 1)}
          aria-label="Previous page"
          aria-disabled={current <= 1}
          className={current <= 1 ? `${btn} ${disabled}` : btn}
          scroll
        >
          <ChevronLeft size={16} />
        </Link>
        <span className="tabular-nums text-sand">
          Page {current} / {pages}
        </span>
        <Link
          href={href(current + 1)}
          aria-label="Next page"
          aria-disabled={current >= pages}
          className={current >= pages ? `${btn} ${disabled}` : btn}
          scroll
        >
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}
