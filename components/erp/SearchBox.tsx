"use client";

import { useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Server-side search input. Debounced; writes `?q=` to the URL (and resets
 * `page` to 1) so the page's server query searches ALL rows, not just the
 * loaded page. Uncontrolled (defaultValue) so typing never loses focus on
 * re-render. Pairs with <Pagination />.
 */
export function SearchBox({
  placeholder = "Search…",
  paramKey = "q",
  className = "",
}: {
  placeholder?: string;
  paramKey?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = sp?.get(paramKey) ?? "";

  const onChange = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? "");
      const t = v.trim();
      if (t) params.set(paramKey, t);
      else params.delete(paramKey);
      params.delete("page"); // a new search always starts on page 1
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
  };

  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        defaultValue={current}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-ink-line bg-ink-card py-2 pl-9 pr-3 text-sm text-cream outline-none placeholder:text-muted focus:border-gold/60"
      />
    </div>
  );
}
