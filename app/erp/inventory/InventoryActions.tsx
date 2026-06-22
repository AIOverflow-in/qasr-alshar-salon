"use client";

import { useState, useRef, useCallback } from "react";
import { ScanBarcode, PackagePlus, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ScannedProduct = {
  id: string;
  name: string;
  category: string;
  qty: number;
  saleAED: number | null;
  barcode: string | null;
};

export function InventoryActions() {
  const [mode, setMode] = useState<null | "scan" | "adjust">(null);

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setMode(mode === "scan" ? null : "scan")}
        className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10 transition-colors"
      >
        <ScanBarcode size={15} /> Barcode Scan
      </button>
      {mode === "scan" && <BarcodeScanPanel onClose={() => setMode(null)} />}
    </div>
  );
}

function BarcodeScanPanel({ onClose }: { onClose: () => void }) {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [qty, setQty] = useState(1);
  const [kind, setKind] = useState<"STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT">("STOCK_IN");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function lookup(code: string) {
    if (!code.trim()) return;
    setSearching(true);
    setNotFound(false);
    setProduct(null);
    try {
      const res = await fetch(`/api/erp/inventory?barcode=${encodeURIComponent(code.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setProduct(data.product);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  }

  async function adjustStock() {
    if (!product) return;
    setSaving(true);
    try {
      const res = await fetch("/api/erp/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, kind, qty: kind === "STOCK_OUT" ? -qty : qty, note }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          setProduct(null);
          setBarcode("");
          setQty(1);
          setNote("");
          inputRef.current?.focus();
        }, 1500);
      }
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-20 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-ink-line bg-ink p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg text-cream flex items-center gap-2">
            <ScanBarcode size={18} className="text-gold" /> Barcode Scanner
          </h3>
          <button onClick={onClose} className="text-muted hover:text-cream"><X size={18} /></button>
        </div>

        <div className="text-xs text-muted">Type or scan a barcode with your device camera / USB scanner.</div>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            autoFocus
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup(barcode)}
            placeholder="Barcode number…"
            className="flex-1 rounded-xl border border-ink-line bg-ink-card px-4 py-2.5 text-cream text-sm outline-none focus:border-gold/60"
          />
          <button
            onClick={() => lookup(barcode)}
            disabled={searching || !barcode.trim()}
            className="rounded-xl border border-gold/40 px-4 py-2.5 text-sm text-gold hover:bg-gold/10 disabled:opacity-40"
          >
            {searching ? <Loader2 size={15} className="animate-spin" /> : "Look up"}
          </button>
        </div>

        {notFound && (
          <div className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
            <AlertTriangle size={15} className="flex-shrink-0" />
            No product found for that barcode.
          </div>
        )}

        {product && (
          <div className="space-y-3">
            <div className="rounded-xl border border-ink-line bg-ink-card p-4">
              <div className="text-cream font-semibold">{product.name}</div>
              <div className="text-xs text-muted mt-0.5">{product.category} · Current qty: <span className={cn("font-semibold", product.qty === 0 ? "text-red-400" : product.qty <= 3 ? "text-gold" : "text-sand")}>{product.qty}</span></div>
              {product.saleAED && <div className="text-xs text-muted mt-0.5">Sale price: AED {product.saleAED}</div>}
            </div>

            <div className="flex gap-2">
              {(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={cn("flex-1 rounded-lg border py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                    kind === k ? "border-gold bg-gold/15 text-gold" : "border-ink-line text-muted hover:border-gold/40"
                  )}
                >
                  {k.replace("_", " ")}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              <label className="text-xs text-muted shrink-0">Qty</label>
              <input
                type="number"
                value={qty}
                min={1}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-center text-cream text-sm outline-none"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="flex-1 rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-cream text-sm outline-none focus:border-gold/40"
              />
            </div>

            <button
              onClick={adjustStock}
              disabled={saving || saved}
              className="w-full rounded-xl bg-gold-gradient py-3 text-sm font-semibold text-espresso disabled:opacity-60"
            >
              {saved ? (
                <span className="flex items-center justify-center gap-2"><CheckCircle2 size={15} /> Saved!</span>
              ) : saving ? (
                <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Saving…</span>
              ) : (
                `${kind === "STOCK_IN" ? "Add" : kind === "STOCK_OUT" ? "Remove" : "Adjust"} ${qty} unit${qty !== 1 ? "s" : ""}`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
