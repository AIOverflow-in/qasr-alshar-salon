"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { aed, cn } from "@/lib/utils";
import type { ShopBadge } from "@/lib/shop-rank";
import { useCart, type CartProductInput } from "./cart";

/** Full-width add-to-cart button for the product detail page. */
export function AddToCartButton({ p }: { p: CartProductInput }) {
  const { add } = useCart();
  return (
    <button onClick={() => add(p)} className="flex w-full items-center justify-center gap-2 rounded-full bg-gold-gradient py-3.5 font-semibold text-espresso sm:w-auto sm:px-10">
      <ShoppingBag size={18} /> Add to cart
    </button>
  );
}

export function ProductCard({ p }: { p: CartProductInput & { category?: string; badge?: ShopBadge } }) {
  const { add } = useCart();
  return (
    <div className="surface flex flex-col overflow-hidden rounded-2xl border border-ink-line">
      <Link href={`/shop/${p.slug}`} className="relative block aspect-square overflow-hidden bg-ink-card">
        {p.badge && (
          <span
            className={cn(
              "absolute left-2 top-2 z-10 rounded-full px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-wide shadow-sm",
              p.badge === "bestseller" ? "bg-gold-gradient text-espresso" : "border border-gold/30 bg-ink-card/90 text-gold-deep",
            )}
          >
            {p.badge === "bestseller" ? "Bestseller" : "Popular"}
          </span>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.imageUrl}
          alt={p.name}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          loading="lazy"
          onError={(e) => { const t = e.currentTarget; if (t.src.indexOf("/gallery/hero.jpg") === -1) t.src = "/gallery/hero.jpg"; }}
        />
      </Link>
      <div className="flex flex-1 flex-col p-3">
        {p.category && <div className="text-[0.7rem] uppercase tracking-wider text-muted">{p.category}</div>}
        <Link href={`/shop/${p.slug}`} className="mt-0.5 line-clamp-2 text-sm text-cream hover:text-gold">{p.name}</Link>
        <div className="mt-1 font-display text-lg text-gold-deep">{aed(p.priceAED)}</div>
        <div className="mt-auto pt-2">
          <button onClick={() => add(p)} className="w-full rounded-lg bg-gold-gradient py-2 text-xs font-semibold text-espresso">Add to cart</button>
        </div>
      </div>
    </div>
  );
}
