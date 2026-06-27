"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, Plus, Minus, Pencil, PackagePlus, Boxes, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Product = {
  id: string; name: string; category: string; barcode: string | null;
  qty: number; costAED: number | null; saleAED: number | null; reorderAt: number;
};

const PAGE = 20;
const empty = { name: "", category: "Retail / Aftercare", barcode: "", qty: "0", costAED: "", saleAED: "", reorderAt: "3" };

export function InventoryTable({ products, categories }: { products: Product[]; categories: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<Product | null>(null);
  const [stockFor, setStockFor] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) =>
      (!cat || p.category === cat) &&
      (!s || p.name.toLowerCase().includes(s) || (p.barcode ?? "").includes(s))
    );
  }, [products, q, cat]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  async function adjust(p: Product, delta: number) {
    setBusy(p.id);
    try {
      await fetch("/api/erp/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: p.id, kind: delta > 0 ? "STOCK_IN" : "STOCK_OUT", qty: delta, note: "Quick adjust" }),
      });
      router.refresh();
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search name or barcode…"
            className="w-full rounded-full border border-ink-line bg-ink-card py-2 pl-9 pr-4 text-sm text-cream placeholder:text-muted outline-none focus:border-gold/60" />
        </div>
        <select value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }}
          className="rounded-full border border-ink-line bg-ink-card px-4 py-2 text-sm text-cream outline-none focus:border-gold/60">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso">
          <PackagePlus size={15} /> Add product
        </button>
      </div>

      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-ink-line text-left text-muted">
            <tr>
              <th className="p-3 font-medium">Product</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">Barcode</th>
              <th className="p-3 font-medium text-center">Stock</th>
              <th className="p-3 font-medium text-right">Sale AED</th>
              <th className="p-3 font-medium text-right">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line/60">
            {slice.map((p) => (
              <tr key={p.id} className={cn(p.qty === 0 && "bg-red-500/5", busy === p.id && "opacity-50")}>
                <td className="p-3 text-cream">{p.name}</td>
                <td className="p-3 text-xs text-muted">{p.category}</td>
                <td className="p-3 font-mono text-xs text-muted">{p.barcode ?? "—"}</td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1.5">
                    <button onClick={() => adjust(p, -1)} disabled={p.qty <= 0 || busy === p.id} className="grid h-6 w-6 place-items-center rounded border border-ink-line text-muted hover:border-gold/50 disabled:opacity-30"><Minus size={12} /></button>
                    <span className={cn("w-8 text-center font-semibold", p.qty === 0 ? "text-red-400" : p.qty <= p.reorderAt ? "text-gold" : "text-sand")}>{p.qty}</span>
                    <button onClick={() => adjust(p, 1)} disabled={busy === p.id} className="grid h-6 w-6 place-items-center rounded border border-ink-line text-muted hover:border-gold/50"><Plus size={12} /></button>
                    <button onClick={() => setStockFor(p)} title="Bulk stock in/out" className="ml-1 grid h-6 w-6 place-items-center rounded border border-ink-line text-muted hover:border-gold/50"><Boxes size={12} /></button>
                  </div>
                </td>
                <td className="p-3 text-right text-sand">{p.saleAED ?? "—"}</td>
                <td className="p-3 text-right">
                  <button onClick={() => setEdit(p)} className="text-muted hover:text-gold"><Pencil size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{filtered.length} product{filtered.length !== 1 ? "s" : ""}</p>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-sand disabled:opacity-40 hover:border-gold/50"><ChevronLeft size={16} /></button>
            <span className="text-xs text-muted">Page {safePage + 1} of {pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={safePage >= pages - 1} className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-sand disabled:opacity-40 hover:border-gold/50"><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {addOpen && <ProductModal title="Add product" categories={categories} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); router.refresh(); }} />}
      {edit && <ProductModal title="Edit product" categories={categories} product={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); router.refresh(); }} />}
      {stockFor && <StockModal product={stockFor} onClose={() => setStockFor(null)} onSaved={() => { setStockFor(null); router.refresh(); }} />}
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input {...props} className="w-full rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60" />
    </label>
  );
}

function ProductModal({ title, product, categories, onClose, onSaved }: {
  title: string; product?: Product; categories: string[]; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState(product
    ? { name: product.name, category: product.category, barcode: product.barcode ?? "", qty: String(product.qty), costAED: product.costAED?.toString() ?? "", saleAED: product.saleAED?.toString() ?? "", reorderAt: String(product.reorderAt) }
    : { ...empty });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!f.name.trim()) { setErr("Name is required."); return; }
    setSaving(true); setErr(null);
    try {
      const body: Record<string, unknown> = {
        name: f.name.trim(), category: f.category.trim(), barcode: f.barcode.trim() || null,
        costAED: f.costAED ? Number(f.costAED) : null, saleAED: f.saleAED ? Number(f.saleAED) : null,
        reorderAt: Number(f.reorderAt) || 0,
      };
      let res: Response;
      if (product) {
        res = await fetch("/api/erp/inventory", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: product.id, ...body }) });
      } else {
        res = await fetch("/api/erp/inventory", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, qty: Number(f.qty) || 0 }) });
      }
      if (!res.ok) { setErr("Could not save."); return; }
      onSaved();
    } catch { setErr("Network error."); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-ink-line bg-ink p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg text-cream">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-cream"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <Field label="Name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Category</span>
            <input list="cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="w-full rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60" />
            <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <Field label="Barcode" value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            {!product && <Field label="Opening qty" type="number" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />}
            <Field label="Cost AED" type="number" value={f.costAED} onChange={(e) => setF({ ...f, costAED: e.target.value })} />
            <Field label="Sale AED" type="number" value={f.saleAED} onChange={(e) => setF({ ...f, saleAED: e.target.value })} />
            <Field label="Reorder at" type="number" value={f.reorderAt} onChange={(e) => setF({ ...f, reorderAt: e.target.value })} />
          </div>
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button onClick={save} disabled={saving} className="w-full rounded-lg bg-gold-gradient py-2.5 text-sm font-semibold text-espresso disabled:opacity-50">
            {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Saving…</span> : "Save product"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StockModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState(1);
  const [kind, setKind] = useState<"STOCK_IN" | "STOCK_OUT">("STOCK_IN");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/erp/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, kind, qty: kind === "STOCK_OUT" ? -qty : qty, note: note || null }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error ?? "Could not adjust."); return; }
      onSaved();
    } catch { setErr("Network error."); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-ink-line bg-ink p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-display text-lg text-cream">Stock adjust</h3>
          <button onClick={onClose} className="text-muted hover:text-cream"><X size={18} /></button>
        </div>
        <p className="mb-4 text-xs text-muted">{product.name} · current: <span className="text-sand">{product.qty}</span></p>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["STOCK_IN", "STOCK_OUT"] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} className={cn("flex-1 rounded-lg border py-2 text-xs font-semibold uppercase tracking-wide", kind === k ? "border-gold bg-gold/15 text-gold" : "border-ink-line text-muted hover:border-gold/40")}>
                {k === "STOCK_IN" ? "Add stock" : "Remove"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">Qty</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-24 rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-center text-sm text-cream outline-none" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="flex-1 rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/40" />
          </div>
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button onClick={save} disabled={saving} className="w-full rounded-lg bg-gold-gradient py-2.5 text-sm font-semibold text-espresso disabled:opacity-50">
            {saving ? "Saving…" : `${kind === "STOCK_IN" ? "Add" : "Remove"} ${qty} unit${qty !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
