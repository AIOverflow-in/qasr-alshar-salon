"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Minus, Pencil, PackagePlus, Boxes, Loader2, X, Upload, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchBox } from "@/components/erp/SearchBox";
import { Pagination } from "@/components/erp/Pagination";

export type Product = {
  id: string; name: string; category: string; barcode: string | null;
  qty: number; costAED: number | null; saleAED: number | null; reorderAt: number;
};

const empty = { name: "", category: "Retail / Aftercare", barcode: "", qty: "0", costAED: "", saleAED: "", reorderAt: "3" };

export function InventoryTable({ products, categories, category, total, page, size }: {
  products: Product[]; categories: string[]; category: string; total: number; page: number; size: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [items, setItems] = useState<Product[]>(products);
  useEffect(() => { setItems(products); }, [products]); // resync after a server refresh / page change
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<Product | null>(null);
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Category filter drives the URL (?category=) so the server filters ALL rows, not just this page.
  function setCategory(v: string) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (v) params.set("category", v);
    else params.delete("category");
    params.delete("page"); // a new filter always starts on page 1
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  async function adjust(p: Product, delta: number) {
    // optimistic: update the cell instantly, persist in the background, revert on failure
    setItems((prev) => prev.map((x) => x.id === p.id ? { ...x, qty: x.qty + delta } : x));
    try {
      const res = await fetch("/api/erp/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: p.id, kind: delta > 0 ? "STOCK_IN" : "STOCK_OUT", qty: delta, note: "Quick adjust" }),
      });
      if (!res.ok) setItems((prev) => prev.map((x) => x.id === p.id ? { ...x, qty: x.qty - delta } : x));
    } catch {
      setItems((prev) => prev.map((x) => x.id === p.id ? { ...x, qty: x.qty - delta } : x));
    }
  }

  async function handleImport(file: File) {
    if (file.size > 5 * 1024 * 1024) { setImportMsg("File too large (max 5 MB)."); return; }
    setImportMsg("Reading…");
    try {
      const text = await file.text();
      // One-pass CSV parse: handles quoted commas, escaped quotes ("") and quoted newlines.
      const parseCsv = (input: string): string[][] => {
        const out: string[][] = [];
        let row: string[] = [], cur = "", inQ = false;
        for (let i = 0; i < input.length; i++) {
          const ch = input[i];
          if (inQ) {
            if (ch === '"') { if (input[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
            else cur += ch;
          } else if (ch === '"') inQ = true;
          else if (ch === ",") { row.push(cur); cur = ""; }
          else if (ch === "\n") { row.push(cur); out.push(row); row = []; cur = ""; }
          else if (ch !== "\r") cur += ch;
        }
        if (cur.length || row.length) { row.push(cur); out.push(row); }
        return out.filter((r) => r.some((c) => c.trim() !== ""));
      };
      const allRows = parseCsv(text);
      if (allRows.length < 2) { setImportMsg("CSV looks empty."); return; }
      const header = allRows[0].map((h) => h.trim().toLowerCase());
      const idx = (k: string) => header.indexOf(k);
      const ci = { name: idx("name"), category: idx("category"), barcode: idx("barcode"), qty: idx("qty"), cost: idx("costaed"), sale: idx("saleaed"), reorder: idx("reorderat") };
      if (ci.name < 0) { setImportMsg("CSV needs a 'name' column."); return; }
      // Parse a decimal-aware number and round to whole dirhams (cost/sale/qty are integers).
      // Keeps the '.' so "12.50" -> 13, not 1250 (the old /[^\d-]/ strip 100×'d decimals).
      const num = (v: string | undefined) => { const n = Math.round(parseFloat((v ?? "").replace(/[^\d.-]/g, ""))); return Number.isFinite(n) ? n : null; };
      const rows = allRows.slice(1).filter((c) => c[ci.name]?.trim()).map((c) => ({
        name: c[ci.name].trim(),
        category: ci.category >= 0 ? c[ci.category]?.trim() ?? null : null,
        barcode: ci.barcode >= 0 ? c[ci.barcode]?.trim() ?? null : null,
        qty: ci.qty >= 0 ? num(c[ci.qty]) : null,
        costAED: ci.cost >= 0 ? num(c[ci.cost]) : null,
        saleAED: ci.sale >= 0 ? num(c[ci.sale]) : null,
        reorderAt: ci.reorder >= 0 ? num(c[ci.reorder]) : null,
      }));
      if (!rows.length) { setImportMsg("No valid rows found."); return; }
      if (rows.length > 5000) { setImportMsg("Too many rows (max 5000 per import)."); return; }
      setImportMsg(`Importing ${rows.length}…`);
      const res = await fetch("/api/erp/inventory/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const data = await res.json();
      if (!res.ok) { setImportMsg(data.error ?? "Import failed."); return; }
      setImportMsg(`✓ ${data.created} added, ${data.updated} updated.`);
      router.refresh();
    } catch { setImportMsg("Could not read the file."); }
  }

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Search name, category or barcode…" className="min-w-[200px] flex-1" />
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="rounded-full border border-ink-line bg-ink-card px-4 py-2 text-sm text-cream outline-none focus:border-gold/60">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <a href="/api/erp/inventory/export" className="inline-flex items-center gap-1.5 rounded-full border border-ink-line px-3.5 py-2 text-sm text-sand hover:border-gold/50">
          <Download size={15} /> Export
        </a>
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 px-3.5 py-2 text-sm text-gold hover:bg-gold/10">
          <Upload size={15} /> Import CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso">
          <PackagePlus size={15} /> Add product
        </button>
      </div>
      {importMsg && <p className="text-sm text-gold">{importMsg} <span className="text-xs text-muted">· CSV columns: name, category, barcode, qty, costAED, saleAED, reorderAt</span></p>}

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
            {items.map((p) => (
              <tr key={p.id} className={cn(p.qty === 0 && "bg-red-500/5")}>
                <td className="p-3 text-cream">{p.name}</td>
                <td className="p-3 text-xs text-muted">{p.category}</td>
                <td className="p-3 font-mono text-xs text-muted">{p.barcode ?? "—"}</td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1.5">
                    <button onClick={() => adjust(p, -1)} disabled={p.qty <= 0} className="grid h-6 w-6 place-items-center rounded border border-ink-line text-muted hover:border-gold/50 disabled:opacity-30"><Minus size={12} /></button>
                    <span className={cn("w-8 text-center font-semibold", p.qty === 0 ? "text-red-600" : p.qty <= p.reorderAt ? "text-gold" : "text-sand")}>{p.qty}</span>
                    <button onClick={() => adjust(p, 1)} className="grid h-6 w-6 place-items-center rounded border border-ink-line text-muted hover:border-gold/50"><Plus size={12} /></button>
                    <button onClick={() => setStockFor(p)} title="Bulk stock in/out" className="ml-1 grid h-6 w-6 place-items-center rounded border border-ink-line text-muted hover:border-gold/50"><Boxes size={12} /></button>
                  </div>
                </td>
                <td className="p-3 text-right text-sand">{p.saleAED ?? "—"}</td>
                <td className="p-3 text-right">
                  <button onClick={() => setEdit(p)} aria-label="Edit product" className="-m-2 p-2 text-muted hover:text-gold"><Pencil size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination total={total} page={page} size={size} />

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
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d?.error || "Could not save.");
        return;
      }
      onSaved();
    } catch { setErr("Network error."); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-10" onClick={onClose}>
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
          {err && <p className="text-sm text-red-600">{err}</p>}
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-10" onClick={onClose}>
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
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button onClick={save} disabled={saving} className="w-full rounded-lg bg-gold-gradient py-2.5 text-sm font-semibold text-espresso disabled:opacity-50">
            {saving ? "Saving…" : `${kind === "STOCK_IN" ? "Add" : "Remove"} ${qty} unit${qty !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
