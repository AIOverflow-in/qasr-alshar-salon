"use client";

import { useEffect, useMemo, useState } from "react";
import { ShoppingBag, X, Plus, Minus, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { aed } from "@/lib/utils";
import type { ShopCard } from "@/lib/shop";

const EMIRATES = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];
const CART_KEY = "qa_shop_cart_v1";

export function ShopSection({ products }: { products: ShopCard[] }) {
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customerName: "", phone: "", email: "", emirate: "Dubai", address: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: string; totalAED: number } | null>(null);

  // Persist the cart across reloads (drop items no longer sold).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
      const clean: Record<string, number> = {};
      for (const [id, q] of Object.entries(saved)) if (byId.has(id) && typeof q === "number" && q > 0) clean[id] = Math.min(q, byId.get(id)!.stock);
      setCart(clean);
    } catch { /* ignore */ }
  }, [byId]);
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* ignore */ } }, [cart]);

  const setQty = (id: string, q: number) => setCart((c) => {
    const stock = byId.get(id)?.stock ?? 0;
    const next = Math.max(0, Math.min(q, stock));
    const copy = { ...c };
    if (next <= 0) delete copy[id]; else copy[id] = next;
    return copy;
  });

  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(id)!, qty })).filter((l) => l.p);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.p.priceAED * l.qty, 0);

  async function checkout() {
    setError(null);
    if (!lines.length) { setError("Your cart is empty."); return; }
    if (form.customerName.trim().length < 2 || form.phone.trim().length < 6 || form.address.trim().length < 6) {
      setError("Please add your name, phone and delivery address."); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/shop/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.p.id, qty: l.qty })),
          customerName: form.customerName, phone: form.phone, email: form.email || null,
          address: form.address, emirate: form.emirate, notes: form.notes || null,
          clientRequestId: (crypto?.randomUUID?.() ?? String(Date.now()) + Math.round(performance.now())),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not place your order. Please try again."); return; }
      setDone({ ref: data.order.ref, totalAED: data.order.totalAED });
      setCart({});
      try { localStorage.removeItem(CART_KEY); } catch { /* ignore */ }
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  }

  if (!products.length) return null;

  return (
    <section id="shop" className="container-x scroll-mt-24 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">The Shop</div>
        <h2 className="mt-3 font-display text-4xl text-cream">Take the salon home</h2>
        <p className="mt-3 text-sand/80">Premium hair &amp; aftercare, delivered across the UAE. Pay cash on delivery.</p>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <div key={p.id} className="surface flex flex-col overflow-hidden rounded-2xl border border-ink-line">
            <div className="aspect-square overflow-hidden bg-ink-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div className="flex flex-1 flex-col p-3">
              <div className="text-[0.6rem] uppercase tracking-wider text-muted">{p.category}</div>
              <div className="mt-0.5 line-clamp-2 text-sm text-cream">{p.name}</div>
              <div className="mt-1 font-display text-lg text-gold">{aed(p.priceAED)}</div>
              <div className="mt-auto pt-2">
                {cart[p.id] ? (
                  <div className="flex items-center justify-between rounded-lg border border-gold/40 px-1">
                    <button onClick={() => setQty(p.id, (cart[p.id] ?? 0) - 1)} className="p-1.5 text-gold"><Minus size={14} /></button>
                    <span className="text-sm text-cream">{cart[p.id]}</span>
                    <button onClick={() => setQty(p.id, (cart[p.id] ?? 0) + 1)} disabled={cart[p.id] >= p.stock} className="p-1.5 text-gold disabled:opacity-30"><Plus size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => setQty(p.id, 1)} className="w-full rounded-lg bg-gold-gradient py-2 text-xs font-semibold text-espresso">Add to cart</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* floating cart button */}
      {count > 0 && !open && (
        <button onClick={() => { setOpen(true); setDone(null); }} className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-3 font-semibold text-espresso shadow-2xl">
          <ShoppingBag size={18} /> {count} · {aed(total)}
        </button>
      )}

      {/* cart / checkout drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onClick={() => setOpen(false)}>
          <div className="h-full w-full max-w-md overflow-y-auto bg-ink p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-2xl text-cream">{done ? "Order placed" : "Your cart"}</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-cream"><X size={22} /></button>
            </div>

            {done ? (
              <div className="text-center">
                <CheckCircle2 size={48} className="mx-auto text-gold" />
                <p className="mt-4 text-cream">Thank you! Your order <span className="font-mono text-gold">{done.ref}</span> is placed.</p>
                <p className="mt-2 text-sm text-sand/80">We&apos;ll call you to confirm and deliver — pay <b className="text-cream">{aed(done.totalAED)}</b> in cash on delivery.</p>
                <button onClick={() => setOpen(false)} className="mt-6 rounded-full border border-ink-line px-6 py-3 text-sand hover:text-gold">Close</button>
              </div>
            ) : lines.length === 0 ? (
              <p className="py-10 text-center text-muted">Your cart is empty.</p>
            ) : (
              <>
                <div className="divide-y divide-ink-line/60">
                  {lines.map((l) => (
                    <div key={l.p.id} className="flex items-center gap-3 py-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.p.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-cream">{l.p.name}</div>
                        <div className="text-xs text-muted">{aed(l.p.priceAED)} × {l.qty}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQty(l.p.id, l.qty - 1)} className="p-1 text-gold"><Minus size={13} /></button>
                        <span className="w-5 text-center text-sm text-cream">{l.qty}</span>
                        <button onClick={() => setQty(l.p.id, l.qty + 1)} disabled={l.qty >= l.p.stock} className="p-1 text-gold disabled:opacity-30"><Plus size={13} /></button>
                        <button onClick={() => setQty(l.p.id, 0)} className="ml-1 p-1 text-muted hover:text-red-400"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-ink-line pt-3 text-cream">
                  <span>Total (COD)</span><span className="font-display text-xl text-gold">{aed(total)}</span>
                </div>

                <div className="mt-5 space-y-2">
                  <input value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} placeholder="Full name" className="w-full rounded-xl border border-ink-line bg-ink-card p-3 text-cream outline-none focus:border-gold/60" />
                  <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="w-full rounded-xl border border-ink-line bg-ink-card p-3 text-cream outline-none focus:border-gold/60" />
                  <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email (optional)" className="w-full rounded-xl border border-ink-line bg-ink-card p-3 text-cream outline-none focus:border-gold/60" />
                  <select value={form.emirate} onChange={(e) => setForm((f) => ({ ...f, emirate: e.target.value }))} className="w-full rounded-xl border border-ink-line bg-ink-card p-3 text-cream outline-none focus:border-gold/60">
                    {EMIRATES.map((em) => <option key={em} value={em} className="bg-ink">{em}</option>)}
                  </select>
                  <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Delivery address" rows={3} className="w-full rounded-xl border border-ink-line bg-ink-card p-3 text-cream outline-none focus:border-gold/60" />
                </div>

                {error && <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

                <button onClick={checkout} disabled={submitting} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gold-gradient py-3.5 font-semibold text-espresso disabled:opacity-50">
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <ShoppingBag size={16} />} Place order · Cash on delivery
                </button>
                <p className="mt-2 text-center text-xs text-muted">No online payment — pay in cash when it arrives.</p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
