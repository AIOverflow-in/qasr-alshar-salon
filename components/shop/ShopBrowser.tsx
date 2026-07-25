"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CartProvider } from "@/components/shop/cart";
import { ProductCard } from "@/components/shop/ProductCard";
import { categoriesOf, filterProducts, pageSlice } from "@/lib/shop-browse-core";
import type { ShopCard } from "@/lib/shop";

const PER_PAGE = 12;

export function ShopBrowser({ products }: { products: ShopCard[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [page, setPage] = useState(1);

  const categories = useMemo(() => categoriesOf(products), [products]);
  const filtered = useMemo(() => filterProducts(products, q, cat), [products, q, cat]);
  const { items, page: cur, pageCount } = pageSlice(filtered, page, PER_PAGE);

  const setSearch = (v: string) => { setQ(v); setPage(1); };
  const setCategory = (c: string) => { setCat(c); setPage(1); };
  const clear = () => { setQ(""); setCat("all"); setPage(1); };
  const chipCls = (on: boolean) =>
    cn("rounded-full border px-3.5 py-1.5 text-xs transition-colors", on ? "border-gold bg-gold/10 text-gold" : "border-ink-line text-sand hover:border-gold/50 hover:text-gold");

  return (
    <CartProvider>
      {/* search + category filters */}
      <div className="mt-10 flex flex-col gap-4">
        <div className="relative mx-auto w-full max-w-md">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className="w-full rounded-full border border-ink-line bg-ink-card py-3 pl-11 pr-10 text-sm text-cream placeholder:text-muted focus:border-gold/60 focus:outline-none"
          />
          {q && (
            <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-cream">
              <X size={16} />
            </button>
          )}
        </div>
        {categories.length > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => setCategory("all")} className={chipCls(cat === "all")}>All</button>
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={chipCls(cat === c)}>{c}</button>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        {filtered.length} product{filtered.length === 1 ? "" : "s"}{q || cat !== "all" ? " found" : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-14 text-center text-muted">
          <p>No products match your search.</p>
          <button onClick={clear} className="mt-3 text-gold hover:underline">Clear filters</button>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
          {pageCount > 1 && (
            <div className="mt-12 flex items-center justify-center gap-4">
              <button
                onClick={() => setPage(cur - 1)}
                disabled={cur <= 1}
                className="rounded-full border border-ink-line px-4 py-2 text-sm text-sand transition-colors hover:border-gold/50 hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-muted">Page {cur} of {pageCount}</span>
              <button
                onClick={() => setPage(cur + 1)}
                disabled={cur >= pageCount}
                className="rounded-full border border-ink-line px-4 py-2 text-sm text-sand transition-colors hover:border-gold/50 hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </CartProvider>
  );
}
