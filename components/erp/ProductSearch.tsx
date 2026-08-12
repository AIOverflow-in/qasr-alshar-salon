"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

/**
 * Search box for the ERP storefront catalogue. With 450+ products, paging through them to find
 * one was the only option. Searches server-side so it covers every product, not just this page.
 */
export function ProductSearch({ initial, total }: { initial: string; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(initial);

  useEffect(() => { setQ(initial); }, [initial]);

  const go = (value: string) => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (value.trim()) params.set("q", value.trim()); else params.delete("q");
    params.delete("page"); // a new search always starts at page 1
    router.push(`${pathname}${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); go(q); }}
      className="flex flex-wrap items-center gap-2"
      role="search"
    >
      <div className="relative min-w-0 flex-1">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products by name, category or barcode…"
          aria-label="Search products"
          className="w-full rounded-lg border border-ink-line bg-ink-card py-2 pl-9 pr-9 text-sm text-cream outline-none placeholder:text-muted focus:border-gold/60"
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); go(""); }} aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-cream">
            <X size={15} />
          </button>
        )}
      </div>
      <button type="submit" className="rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso">Search</button>
      {initial && <span className="text-xs text-muted">{total} match{total === 1 ? "" : "es"} for &ldquo;{initial}&rdquo;</span>}
    </form>
  );
}
