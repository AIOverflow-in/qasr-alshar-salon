"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { aed } from "@/lib/utils";
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

export function ProductCard({ p }: { p: CartProductInput & { category?: string } }) {
  const { add } = useCart();
  return (
    <div className="surface flex flex-col overflow-hidden rounded-2xl border border-ink-line">
      <Link href={`/shop/${p.slug}`} className="block aspect-square overflow-hidden bg-ink-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" loading="lazy" />
      </Link>
      <div className="flex flex-1 flex-col p-3">
        {p.category && <div className="text-[0.6rem] uppercase tracking-wider text-muted">{p.category}</div>}
        <Link href={`/shop/${p.slug}`} className="mt-0.5 line-clamp-2 text-sm text-cream hover:text-gold">{p.name}</Link>
        <div className="mt-1 font-display text-lg text-gold">{aed(p.priceAED)}</div>
        <div className="mt-auto pt-2">
          <button onClick={() => add(p)} className="w-full rounded-lg bg-gold-gradient py-2 text-xs font-semibold text-espresso">Add to cart</button>
        </div>
      </div>
    </div>
  );
}
