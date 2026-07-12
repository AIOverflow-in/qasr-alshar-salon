"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Paperclip, X, AlertTriangle } from "lucide-react";
import { addExpense } from "@/lib/actions/finance";
import { uploadToBlob } from "@/lib/blob-upload-client";
import { EXPENSE_CATEGORIES } from "@/lib/expense-filter";

const label = (c: string) => c[0] + c.slice(1).toLowerCase();
const input = "rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60";
// Any photo or document — incl. iPhone HEIC. Direct-to-Blob upload handles up to 20 MB.
const ACCEPT = "image/*,.heic,.heif,application/pdf,.doc,.docx,.xls,.xlsx,.csv";

/**
 * Shared expense-entry form. The receipt uploads DIRECTLY to Blob storage (any
 * file up to 20 MB), and — critically — it is NON-BLOCKING: if the upload fails,
 * the expense is still saved and the user is told to retry the receipt. A receipt
 * problem can never again swallow the whole expense.
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
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const initialCat = categories.includes("SUPPLIES") ? "SUPPLIES" : categories[0];
  const [f, setF] = useState({ category: initialCat, incurredOn: "", description: "", amountAED: "", invoiceNo: "", recurring: false });
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setF({ category: initialCat, incurredOn: "", description: "", amountAED: "", invoiceNo: "", recurring: false });
    setFile(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit() {
    setErr(null);
    setNotice(null);
    if (!f.description.trim()) { setErr("Add a short description."); return; }
    if (!Number(f.amountAED) || Number(f.amountAED) <= 0) { setErr("Add a positive amount."); return; }
    start(async () => {
      // 1) Try the receipt — but NEVER let it block the expense.
      let receiptUrl: string | null = null;
      let receiptPath: string | null = null;
      let receiptFailed = false;
      if (file) {
        setUploading(true);
        setProgress(0);
        try {
          const up = await uploadToBlob(file, "receipt", { onProgress: setProgress });
          receiptUrl = up.url;
          receiptPath = up.pathname;
        } catch {
          receiptFailed = true; // keep going — save the expense anyway
        } finally {
          setUploading(false);
        }
      }
      // 2) Save the expense (this must succeed; the receipt is optional).
      try {
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
      } catch {
        setErr("Could not save the expense. Please try again.");
        return;
      }
      reset();
      router.refresh();
      if (receiptFailed) setNotice("Expense saved — but the receipt didn't upload. Open the expense to attach it again.");
      onAdded?.();
    });
  }

  const busy = pending || uploading;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <select value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))} className={input} aria-label="Category">
        {categories.map((c) => <option key={c} value={c}>{label(c)}</option>)}
      </select>
      <input type="datetime-local" value={f.incurredOn} onChange={(e) => setF((p) => ({ ...p, incurredOn: e.target.value }))} onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* not supported → native icon still works */ } }} className={input} aria-label="Date & time" title="Tap to pick the date & time this expense was incurred" />
      <input value={f.description} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} placeholder="What was it for?" className={`${input} sm:col-span-2`} />
      <input type="number" min={0} value={f.amountAED} onChange={(e) => setF((p) => ({ ...p, amountAED: e.target.value }))} placeholder="Amount AED" className={input} />
      <input value={f.invoiceNo} onChange={(e) => setF((p) => ({ ...p, invoiceNo: e.target.value }))} placeholder="Invoice # (optional)" className={input} />

      <div className="sm:col-span-2">
        {file ? (
          <div className="flex items-center gap-2 rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream">
            <Paperclip size={14} className="text-gold" />
            <span className="min-w-0 flex-1 truncate">{file.name} <span className="text-muted">· {(file.size / 1024 / 1024).toFixed(1)} MB</span></span>
            {!busy && <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} aria-label="Remove receipt" className="-m-1 p-1 text-muted hover:text-red-400"><X size={14} /></button>}
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-line bg-ink-card px-3 py-2 text-sm text-muted hover:border-gold/50 hover:text-gold">
            <Paperclip size={14} /> Attach receipt / invoice — photo or PDF (optional, up to 20 MB)
            <input ref={fileRef} type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
          </label>
        )}
        {uploading && (
          <div className="mt-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-line">
              <div className="h-full rounded-full bg-gold-gradient transition-all" style={{ width: `${Math.max(6, progress)}%` }} />
            </div>
            <p className="mt-1 text-xs text-gold">Uploading receipt… {progress}%</p>
          </div>
        )}
      </div>

      {showRecurring && (
        <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2">
          <input type="checkbox" checked={f.recurring} onChange={(e) => setF((p) => ({ ...p, recurring: e.target.checked }))} />
          Recurring monthly (rent, salaries)
        </label>
      )}

      {err && <p className="text-xs text-red-400 sm:col-span-2">{err}</p>}
      {notice && (
        <p className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 sm:col-span-2">
          <AlertTriangle size={13} className="shrink-0" /> {notice}
        </p>
      )}

      <button onClick={submit} disabled={busy} className="flex items-center justify-center gap-1.5 rounded-lg bg-gold-gradient px-3 py-2 text-sm font-semibold text-espresso disabled:opacity-50 sm:col-span-2">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {uploading ? `Uploading… ${progress}%` : pending ? "Saving…" : "Add expense"}
      </button>
    </div>
  );
}
