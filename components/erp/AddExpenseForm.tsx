"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Paperclip, X } from "lucide-react";
import { addExpense } from "@/lib/actions/finance";
import { EXPENSE_CATEGORIES } from "@/lib/expense-filter";

const label = (c: string) => c[0] + c.slice(1).toLowerCase();

const input = "rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60";

/**
 * Shared expense-entry form — used by the admin Finance page and the reception
 * add-only Expenses screen. Uploads an optional receipt/invoice photo to Blob
 * first, then logs the expense. `showRecurring` is admin-only. `categories`
 * limits the category picker (reception's Expenses tab shows a short list).
 */
export function AddExpenseForm({
  showRecurring = false,
  onAdded,
  categories = EXPENSE_CATEGORIES as readonly string[],
}: {
  showRecurring?: boolean;
  onAdded?: () => void;
  categories?: readonly string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const initialCat = categories.includes("SUPPLIES") ? "SUPPLIES" : categories[0];
  const [f, setF] = useState({ category: initialCat, incurredOn: "", description: "", amountAED: "", invoiceNo: "", recurring: false });
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setF({ category: initialCat, incurredOn: "", description: "", amountAED: "", invoiceNo: "", recurring: false });
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit() {
    setErr(null);
    if (!f.description.trim()) { setErr("Add a short description."); return; }
    if (!Number(f.amountAED) || Number(f.amountAED) <= 0) { setErr("Add a positive amount."); return; }
    start(async () => {
      try {
        let receiptUrl: string | null = null;
        let receiptPath: string | null = null;
        if (file) {
          setUploading(true);
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/erp/expense-receipt", { method: "POST", body: fd });
          const data = await res.json().catch(() => ({}));
          setUploading(false);
          if (!res.ok) { setErr(data.error || "Receipt upload failed."); return; }
          receiptUrl = data.url;
          receiptPath = data.pathname ?? null;
        }
        await addExpense({
          category: f.category,
          description: f.description,
          amountAED: Number(f.amountAED),
          incurredOn: f.incurredOn || null,
          invoiceNo: f.invoiceNo || null,
          recurring: f.recurring,
          receiptUrl,
          receiptPath,
        });
        reset();
        router.refresh();
        onAdded?.();
      } catch {
        setUploading(false);
        setErr("Could not save the expense. Please try again.");
      }
    });
  }

  const busy = pending || uploading;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <select value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))} className={input} aria-label="Category">
        {categories.map((c) => <option key={c} value={c}>{label(c)}</option>)}
      </select>
      <input type="date" value={f.incurredOn} onChange={(e) => setF((p) => ({ ...p, incurredOn: e.target.value }))} className={`${input} [color-scheme:dark]`} aria-label="Date" />
      <input value={f.description} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} placeholder="What was it for?" className={`${input} sm:col-span-2`} />
      <input type="number" min={0} value={f.amountAED} onChange={(e) => setF((p) => ({ ...p, amountAED: e.target.value }))} placeholder="Amount AED" className={input} />
      <input value={f.invoiceNo} onChange={(e) => setF((p) => ({ ...p, invoiceNo: e.target.value }))} placeholder="Invoice # (optional)" className={input} />

      <div className="sm:col-span-2">
        {file ? (
          <div className="flex items-center gap-2 rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream">
            <Paperclip size={14} className="text-gold" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} aria-label="Remove receipt" className="-m-1 p-1 text-muted hover:text-red-400"><X size={14} /></button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-line bg-ink-card px-3 py-2 text-sm text-muted hover:border-gold/50 hover:text-gold">
            <Paperclip size={14} /> Attach receipt / invoice photo (optional)
            <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
          </label>
        )}
      </div>

      {showRecurring && (
        <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2">
          <input type="checkbox" checked={f.recurring} onChange={(e) => setF((p) => ({ ...p, recurring: e.target.checked }))} />
          Recurring monthly (rent, salaries)
        </label>
      )}

      {err && <p className="text-xs text-red-400 sm:col-span-2">{err}</p>}

      <button onClick={submit} disabled={busy} className="flex items-center justify-center gap-1.5 rounded-lg bg-gold-gradient px-3 py-2 text-sm font-semibold text-espresso disabled:opacity-50 sm:col-span-2">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {uploading ? "Uploading…" : "Add expense"}
      </button>
    </div>
  );
}
