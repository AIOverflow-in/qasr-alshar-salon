"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Upload, Check, X, Pencil } from "lucide-react";
import { aed } from "@/lib/utils";
import { uploadToBlob } from "@/lib/blob-upload-client";

type Product = {
  id: string; name: string; category: string; saleAED: number | null; qty: number;
  retail: boolean; description: string | null; imageUrl: string | null; active: boolean;
};

const input = "rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60";

async function uploadImage(file: File): Promise<string> {
  // Direct-to-Blob upload (any image up to 20 MB, no serverless size limit).
  const up = await uploadToBlob(file, "product-image");
  return up.url;
}

export function CatalogManager({ products }: { products: Product[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const empty = { name: "", category: "Hair Extensions", saleAED: "", qty: "", description: "", imageUrl: "", retail: true };
  const [form, setForm] = useState<typeof empty>(empty);
  const fileRef = useRef<HTMLInputElement>(null);

  function startEdit(p: Product) {
    setError(null);
    setEditId(p.id);
    setShowAdd(false);
    setForm({ name: p.name, category: p.category, saleAED: String(p.saleAED ?? ""), qty: String(p.qty), description: p.description ?? "", imageUrl: p.imageUrl ?? "", retail: p.retail });
  }
  function startAdd() { setError(null); setEditId(null); setForm(empty); setShowAdd(true); }
  function cancel() { setShowAdd(false); setEditId(null); setError(null); }

  async function pickImage(file: File | null) {
    if (!file) return;
    setError(null); setBusy(true);
    try { const url = await uploadImage(file); setForm((f) => ({ ...f, imageUrl: url })); }
    catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function save() {
    setError(null);
    if (!form.name.trim()) { setError("Add a product name."); return; }
    const price = Number(form.saleAED);
    if (!price || price <= 0) { setError("Add a price."); return; }
    setBusy(true);
    try {
      const payload = {
        name: form.name, category: form.category, saleAED: Math.round(price),
        description: form.description || null, imageUrl: form.imageUrl || null, retail: form.retail,
        ...(editId ? {} : { qty: Math.max(0, Math.round(Number(form.qty) || 0)) }),
      };
      const res = await fetch("/api/erp/inventory", {
        method: editId ? "PATCH" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editId ? { id: editId, ...payload } : payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not save."); return; }
      cancel();
      router.refresh();
    } catch { setError("Network error. Please try again."); }
    finally { setBusy(false); }
  }

  async function togglePublish(p: Product) {
    setBusy(true);
    try {
      await fetch("/api/erp/inventory", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, retail: !p.retail }) });
      router.refresh();
    } finally { setBusy(false); }
  }

  const editing = showAdd || editId !== null;

  return (
    <div className="space-y-5">
      {!editing && (
        <button onClick={startAdd} className="flex items-center gap-1.5 rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso">
          <Plus size={15} /> Add product
        </button>
      )}

      {editing && (
        <div className="surface rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg text-cream">{editId ? "Edit product" : "New product"}</h2>
            <button onClick={cancel} className="text-muted hover:text-cream"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 sm:col-span-2">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink-line bg-ink-card">
                {form.imageUrl ? <img src={form.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-[0.6rem] text-muted">No image</span>}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} className={`${input} file:mr-3 file:rounded file:border-0 file:bg-gold/20 file:px-3 file:py-1 file:text-gold`} />
                <p className="mt-1 text-[0.65rem] text-muted">JPG/PNG/WEBP, max 5 MB. Shown on the shop.</p>
              </div>
            </div>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Product name" className={`${input} sm:col-span-2`} />
            <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Category (e.g. Hair Extensions)" className={input} />
            <input type="number" value={form.saleAED} onChange={(e) => setForm((f) => ({ ...f, saleAED: e.target.value }))} placeholder="Price AED" className={input} />
            {!editId && <input type="number" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} placeholder="Stock qty" className={input} />}
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description" rows={3} className={`${input} sm:col-span-2`} />
            <label className="flex items-center gap-2 text-sm text-sand sm:col-span-2">
              <input type="checkbox" checked={form.retail} onChange={(e) => setForm((f) => ({ ...f, retail: e.target.checked }))} className="h-4 w-4 accent-[#c8911f]" />
              Publish to the storefront (needs a price, image &amp; stock to appear)
            </label>
          </div>
          {error && <div className="mt-3 rounded-lg border border-red-500/40 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <button onClick={save} disabled={busy} className="mt-4 flex items-center gap-1.5 rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {editId ? "Save changes" : "Create product"}
          </button>
        </div>
      )}

      <div className="surface rounded-2xl p-5">
        <h2 className="font-display text-lg text-cream">Products ({products.length})</h2>
        <div className="mt-3 divide-y divide-ink-line/60">
          {products.length === 0 && <p className="py-8 text-center text-sm text-muted">No products yet — add your first above.</p>}
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-ink-line bg-ink-card">
                {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-[0.55rem] text-muted">No image</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-cream">{p.name}</div>
                <div className="text-xs text-muted">{p.category} · {p.saleAED ? aed(p.saleAED) : "no price"} · {p.qty} in stock</div>
              </div>
              <button onClick={() => togglePublish(p)} disabled={busy}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold ${p.retail ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-ink-line text-muted"}`}>
                {p.retail ? "Published" : "Hidden"}
              </button>
              <button onClick={() => startEdit(p)} className="shrink-0 text-muted hover:text-gold"><Pencil size={15} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
