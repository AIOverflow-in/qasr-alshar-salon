"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ShoppingBag, X, Plus, Minus, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { aed } from "@/lib/utils";

export type CartProductInput = { id: string; slug: string; name: string; priceAED: number; stock: number; imageUrl: string };
type CartItem = CartProductInput & { qty: number };

const EMIRATES = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];
const CART_KEY = "qa_shop_cart_v2";

type Ctx = { items: CartItem[]; add: (p: CartProductInput) => void; setQty: (id: string, qty: number) => void; clear: () => void; count: number; total: number; open: () => void };
const CartContext = createContext<Ctx | null>(null);
export function useCart() { const c = useContext(CartContext); if (!c) throw new Error("useCart must be used within CartProvider"); return c; }

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      if (Array.isArray(saved)) setItems(saved.filter((i) => i && i.id && i.qty > 0));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { /* ignore */ } }, [items]);

  const add = useCallback((p: CartProductInput) => {
    setItems((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex) return prev.map((i) => (i.id === p.id ? { ...i, qty: Math.min(i.qty + 1, p.stock) } : i));
      return [...prev, { ...p, qty: 1 }];
    });
    setDrawer(true);
  }, []);
  const setQty = useCallback((id: string, qty: number) => setItems((prev) => prev.flatMap((i) => {
    if (i.id !== id) return [i];
    const q = Math.max(0, Math.min(Math.floor(qty), i.stock));
    return q <= 0 ? [] : [{ ...i, qty: q }];
  })), []);
  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.priceAED * i.qty, 0);
  const value = useMemo(() => ({ items, add, setQty, clear, count, total, open: () => setDrawer(true) }), [items, add, setQty, clear, count, total]);

  return (
    <CartContext.Provider value={value}>
      {children}
      {count > 0 && !drawer && (
        <button onClick={() => setDrawer(true)} className="fixed bottom-40 right-4 z-40 flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-3 font-semibold text-espresso shadow-2xl lg:bottom-6 lg:right-6">
          <ShoppingBag size={18} /> {count} · {aed(total)}
        </button>
      )}
      {drawer && <CartDrawer onClose={() => setDrawer(false)} />}
    </CartContext.Provider>
  );
}

function CartDrawer({ onClose }: { onClose: () => void }) {
  const { items, setQty, clear, total } = useCart();
  const [form, setForm] = useState({ customerName: "", phone: "", email: "", emirate: "Dubai", address: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: string; totalAED: number } | null>(null);

  async function checkout() {
    setError(null);
    if (!items.length) { setError("Your cart is empty."); return; }
    if (form.customerName.trim().length < 2 || form.phone.trim().length < 6 || form.address.trim().length < 6) { setError("Please add your name, phone and delivery address."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/shop/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.id, qty: i.qty })),
          customerName: form.customerName, phone: form.phone, email: form.email || null, address: form.address, emirate: form.emirate,
          clientRequestId: (crypto?.randomUUID?.() ?? String(Date.now())),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not place your order. Please try again."); return; }
      setDone({ ref: data.order.ref, totalAED: data.order.totalAED });
      clear();
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-ink p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl text-cream">{done ? "Order placed" : "Your cart"}</h3>
          <button onClick={onClose} className="text-muted hover:text-cream"><X size={22} /></button>
        </div>

        {done ? (
          <div className="text-center">
            <CheckCircle2 size={48} className="mx-auto text-gold" />
            <p className="mt-4 text-cream">Thank you! Your order <span className="font-mono text-gold">{done.ref}</span> is placed.</p>
            <p className="mt-2 text-sm text-sand/80">We&apos;ll call you to confirm and deliver — pay <b className="text-cream">{aed(done.totalAED)}</b> in cash on delivery.</p>
            <button onClick={onClose} className="mt-6 rounded-full border border-ink-line px-6 py-3 text-sand hover:text-gold">Continue shopping</button>
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-muted">Your cart is empty.</p>
        ) : (
          <>
            <div className="divide-y divide-ink-line/60">
              {items.map((i) => (
                <div key={i.id} className="flex items-center gap-3 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-cream">{i.name}</div>
                    <div className="text-xs text-muted">{aed(i.priceAED)} × {i.qty}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(i.id, i.qty - 1)} aria-label="Decrease quantity" className="grid h-9 w-9 place-items-center rounded-lg text-gold"><Minus size={15} /></button>
                    <span className="w-5 text-center text-sm text-cream">{i.qty}</span>
                    <button onClick={() => setQty(i.id, i.qty + 1)} disabled={i.qty >= i.stock} aria-label="Increase quantity" className="grid h-9 w-9 place-items-center rounded-lg text-gold disabled:opacity-30"><Plus size={15} /></button>
                    <button onClick={() => setQty(i.id, 0)} aria-label="Remove item" className="ml-1 grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-red-400"><Trash2 size={15} /></button>
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
  );
}
