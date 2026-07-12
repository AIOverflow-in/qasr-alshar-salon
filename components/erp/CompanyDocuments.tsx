"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, Loader2, FileText, Download, Eye } from "lucide-react";
import { FilePreviewModal } from "./FilePreviewModal";
import { inlineKind } from "@/lib/file-preview-core";
import { uploadToBlob } from "@/lib/blob-upload-client";
import { createCompanyDocument } from "@/lib/actions/admin";

type Doc = { id: string; title: string; description: string | null; category: string; fileName: string | null; sizeBytes: number | null; createdAt: string };

const CATEGORIES = ["TAX", "LICENSE", "LEASE", "INSURANCE", "FINANCE", "HR", "OTHER"];
const label = (c: string) => c[0] + c.slice(1).toLowerCase();
const fmtDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
const fmtSize = (b: number | null) => (b == null ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export function CompanyDocuments({ docs, canEdit }: { docs: Doc[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "TAX" });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<Doc | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const input = "rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream outline-none focus:border-gold/60";

  async function submit() {
    setError(null);
    if (!form.title.trim()) { setError("Add a title."); return; }
    if (!file) { setError("Choose a file to upload."); return; }
    setBusy(true);
    setProgress(0);
    try {
      // Direct-to-Blob upload (any file up to 20 MB), then persist the metadata.
      const up = await uploadToBlob(file, "company-doc", { onProgress: setProgress });
      const res = await createCompanyDocument({ title: form.title, description: form.description, category: form.category, fileUrl: up.url, pathname: up.pathname, fileName: up.name, sizeBytes: up.size });
      if (!res?.ok) { setError(res?.error || "Could not save the document."); return; }
      setForm({ title: "", description: "", category: "TAX" });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch { setError("Upload failed. Please try again."); }
    finally { setBusy(false); }
  }

  function remove(id: string) {
    if (!confirm("Delete this document? This can't be undone.")) return;
    start(async () => {
      await fetch(`/api/erp/company-doc/${id}`, { method: "DELETE" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="surface rounded-2xl p-5">
          <h2 className="flex items-center gap-2 font-display text-xl text-cream"><Upload size={18} className="text-gold" /> Upload a document</h2>
          <p className="text-xs text-muted">Tax filings, agreements, licences, insurance — stored securely, only you and admins can open them.</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Title (e.g. VAT return Q2 2026)" className={`${input} sm:col-span-2`} />
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description / notes (optional)" rows={2} className={`${input} sm:col-span-2`} />
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className={input}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
            </select>
            <input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={`${input} w-full min-w-0 file:mr-3 file:rounded file:border-0 file:bg-gold/20 file:px-3 file:py-1 file:text-gold`} />
          </div>
          {busy && progress > 0 && (
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-line"><div className="h-full rounded-full bg-gold-gradient transition-all" style={{ width: `${Math.max(6, progress)}%` }} /></div>
              <p className="mt-1 text-xs text-gold">Uploading… {progress}%</p>
            </div>
          )}
          <button onClick={submit} disabled={busy} className="mt-3 flex items-center gap-1.5 rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {busy ? (progress > 0 ? `Uploading… ${progress}%` : "Saving…") : "Upload"}
          </button>
          {error && <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}
        </div>
      )}

      <div className="surface rounded-2xl p-5">
        <h2 className="font-display text-xl text-cream">Documents ({docs.length})</h2>
        <div className="mt-3 divide-y divide-ink-line/60">
          {docs.length === 0 && <p className="py-8 text-center text-sm text-muted">No documents yet.</p>}
          {docs.map((d) => (
            <div key={d.id} className="flex items-start justify-between gap-3 py-3">
              <div className="flex min-w-0 gap-3">
                <FileText size={18} className="mt-0.5 shrink-0 text-gold/70" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-cream">{d.title}</span>
                    <span className="rounded-full border border-ink-line px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-sand">{label(d.category)}</span>
                  </div>
                  {d.description && <div className="mt-0.5 text-xs text-muted">{d.description}</div>}
                  <div className="mt-0.5 text-[0.7rem] text-muted/70">{fmtDate(d.createdAt)}{d.fileName ? ` · ${d.fileName}` : ""}{d.sizeBytes ? ` · ${fmtSize(d.sizeBytes)}` : ""}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => setPreview(d)} className="inline-flex items-center gap-1 rounded-lg border border-gold/40 px-2.5 py-1.5 text-xs text-gold hover:bg-gold/10"><Eye size={13} /> Open</button>
                <a href={`/api/erp/company-doc/${d.id}`} className="inline-flex items-center gap-1 rounded-lg border border-ink-line px-2.5 py-1.5 text-xs text-sand hover:border-gold/50 hover:text-gold"><Download size={13} /> Download</a>
                {canEdit && <button onClick={() => remove(d.id)} disabled={pending} className="text-muted hover:text-red-400 disabled:opacity-40"><Trash2 size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {preview && (
        <FilePreviewModal
          url={`/api/erp/company-doc/${preview.id}?inline=1`}
          downloadUrl={`/api/erp/company-doc/${preview.id}`}
          kind={inlineKind(preview.fileName ?? "")}
          title={preview.title}
          details={[
            { label: "Category", value: label(preview.category), strong: true },
            ...(preview.description ? [{ label: "Description", value: preview.description }] : []),
            ...(preview.fileName ? [{ label: "File", value: preview.fileName }] : []),
            ...(preview.sizeBytes ? [{ label: "Size", value: fmtSize(preview.sizeBytes) }] : []),
            { label: "Uploaded", value: fmtDate(preview.createdAt) },
          ]}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
