"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Tag, Check, X, AlertTriangle } from "lucide-react";
import { aed } from "@/lib/utils";
import { bulkSetProductPrice } from "@/lib/actions/admin";

type P = { id: string; name: string; category: string; saleAED: number | null };

/**
 * Set one price across many products at once — with a preview of every change before it is saved.
 * Built because repricing 76 wigs one at a time is unusable, and because guessing which products
 * to reprice is not something software should do on the owner's behalf.
 */
export function BulkPriceEditor({ products }: { products: P[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [price, setPrice] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const chosen = useMemo(() => products.filter((p) => sel.has(p.id)), [products, sel]);
  const newPrice = parseInt(price) || 0;
  const changing = chosen.filter((p) => (p.saleAED ?? 0) !== newPrice);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = () => setSel(new Set(products.map((p) => p.id)));
  const clear = () => { setSel(new Set()); setDone(null); };

  const apply = () => {
    setError(null); setDone(null);
    start(async () => {
      try {
        const r = await bulkSetProductPrice([...sel], newPrice);
        setDone(r.updated); setSel(new Set()); setPrice(""); router.refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Could not update."); }
    });
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10">
        <Tag size={15} /> Bulk price update
      </button>
    );
  }

  return (
    <div className="surface rounded-2xl border border-gold/30 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-lg text-cream"><Tag size={16} className="text-gold" /> Bulk price update</h3>
        <button onClick={() => { setOpen(false); clear(); }} className="text-muted hover:text-cream"><X size={18} /></button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Tick the products, set one price, and check the preview before saving. Only the products shown on this page can be selected —
        use the search above to narrow them first.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={allOnPage} className="rounded-lg border border-ink-line px-3 py-1.5 text-xs text-sand hover:text-gold">Select all on this page ({products.length})</button>
        <button onClick={clear} className="rounded-lg border border-ink-line px-3 py-1.5 text-xs text-sand hover:text-gold">Clear</button>
        <input
          type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="New price (AED)"
          className="w-44 rounded-lg border border-ink-line bg-ink-card px-3 py-1.5 text-sm text-cream outline-none focus:border-gold/60"
        />
        <button
          onClick={apply}
          disabled={pending || !sel.size || newPrice <= 0}
          className="rounded-lg bg-gold-gradient px-4 py-1.5 text-sm font-semibold text-espresso disabled:opacity-40"
        >
          {pending ? "Saving…" : `Apply to ${sel.size} product${sel.size === 1 ? "" : "s"}`}
        </button>
      </div>

      {error && <p className="mt-2 rounded-lg border border-red-500/40 bg-red-50 p-2 text-xs text-red-600">{error}</p>}
      {done !== null && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-green-600/40 bg-green-500/10 p-2 text-xs text-green-700">
          <Check size={14} /> Updated {done} product{done === 1 ? "" : "s"}. The storefront is already showing the new prices.
        </p>
      )}

      {/* Preview — never save without showing exactly what changes. */}
      {sel.size > 0 && newPrice > 0 && (
        <div className="mt-3 rounded-lg border border-ink-line p-3">
          <div className="text-[0.65rem] uppercase tracking-wider text-muted">
            Preview — {changing.length} of {chosen.length} will change
          </div>
          <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto text-xs">
            {chosen.slice(0, 40).map((p) => {
              const from = p.saleAED ?? 0;
              const same = from === newPrice;
              return (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sand">{p.name}</span>
                  <span className={same ? "shrink-0 text-muted" : "shrink-0 text-cream"}>
                    {aed(from)} → <span className={same ? "" : from > newPrice ? "text-red-500" : "text-green-600"}>{aed(newPrice)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {chosen.length > 40 && <p className="mt-1 text-[0.65rem] text-muted">…and {chosen.length - 40} more</p>}
          {changing.some((p) => (p.saleAED ?? 0) > newPrice * 2) && (
            <p className="mt-2 flex items-center gap-1.5 text-[0.65rem] text-amber-700">
              <AlertTriangle size={12} /> Some prices drop by more than half — double-check before saving.
            </p>
          )}
        </div>
      )}

      {/* Pickable list */}
      <div className="mt-3 max-h-64 divide-y divide-ink-line/60 overflow-y-auto rounded-lg border border-ink-line">
        {products.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gold/5">
            <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} className="accent-[#8a6a1e]" />
            <span className="min-w-0 flex-1 truncate text-cream">{p.name}</span>
            <span className="shrink-0 text-xs text-muted">{p.category}</span>
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-sand">{p.saleAED ? aed(p.saleAED) : "—"}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
