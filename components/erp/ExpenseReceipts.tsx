"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, Plus, X, Loader2 } from "lucide-react";
import { FilePreviewModal, type PreviewDetail } from "./FilePreviewModal";
import { uploadToBlob } from "@/lib/blob-upload-client";
import { addExpenseReceipt, removeExpenseReceipt } from "@/lib/actions/finance";

const ACCEPT = "image/*,.heic,.heif,application/pdf,.doc,.docx,.xls,.xlsx,.csv";

/**
 * All receipts attached to an expense: each opens a side-by-side preview, and
 * (when the user may edit the expense) more can be added or removed inline.
 * Server actions re-check permissions, so the UI hint is just convenience.
 */
export function ExpenseReceipts({ expenseId, urls, title, details, canEdit = false }: {
  expenseId: string;
  urls: string[];
  title: string;
  details: PreviewDetail[];
  canEdit?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = pending || uploading;

  function onPick(file: File) {
    setUploading(true);
    start(async () => {
      try {
        const up = await uploadToBlob(file, "receipt");
        await addExpenseReceipt(expenseId, up.url, up.pathname);
      } catch { /* upload failed — leave the expense untouched */ } finally { setUploading(false); }
    });
  }

  if (!urls.length && !canEdit) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {urls.map((u, i) => (
        <span key={u} className="inline-flex items-center gap-0.5">
          <button type="button" onClick={() => setPreview(u)} className="inline-flex items-center gap-0.5 text-gold hover:underline">
            <Paperclip size={11} /> receipt{urls.length > 1 ? ` ${i + 1}` : ""}
          </button>
          {canEdit && !busy && (
            <button type="button" onClick={() => start(() => removeExpenseReceipt(expenseId, u))} aria-label="Remove this receipt" className="text-muted hover:text-red-400"><X size={10} /></button>
          )}
        </span>
      ))}
      {canEdit && (
        <label className="inline-flex cursor-pointer items-center gap-0.5 text-muted hover:text-gold">
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} add
          <input ref={fileRef} type="file" accept={ACCEPT} disabled={busy} className="hidden" onChange={(e) => { const fl = e.target.files?.[0]; if (fl) onPick(fl); if (fileRef.current) fileRef.current.value = ""; }} />
        </label>
      )}
      {preview && <FilePreviewModal url={preview} title={title} details={details} onClose={() => setPreview(null)} />}
    </span>
  );
}
