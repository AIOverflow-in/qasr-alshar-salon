"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Upload, FileText, Plane, AlertTriangle, Eye } from "lucide-react";
import { deleteStaffDocument, addStaffDocument, addStaffLeave, deleteStaffLeave } from "@/lib/actions/admin";
import { FilePreviewModal, type PreviewDetail } from "./FilePreviewModal";
import { uploadToBlob } from "@/lib/blob-upload-client";
import { cn } from "@/lib/utils";

type PreviewKind = "image" | "pdf" | "other";
type Doc = { id: string; type: string; expiry: string | null; uploadedAt: string; kind: PreviewKind };
type Leave = { id: string; startDate: string; endDate: string; days: number; type: string; note: string | null };
type Summary = { eligible: boolean; entitlement: number; taken: number; remaining: number };

const DOC_TYPES: [string, string][] = [
  ["PASSPORT", "Passport"], ["VISA", "Visa"], ["LABOR_CARD", "Labour card"], ["EMIRATES_ID", "Emirates ID"], ["OTHER", "Other"],
];
const typeLabel = (t: string) => DOC_TYPES.find(([v]) => v === t)?.[1] ?? t;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const expiringSoon = (iso: string | null) => !!iso && new Date(iso).getTime() < Date.now() + 30 * 864e5;

export function StaffAdmin({ staffId, documents, leaves, summary, canViewDocs }: { staffId: string; documents: Doc[]; leaves: Leave[]; summary: Summary; canViewDocs: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // ── documents ──
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("PASSPORT");
  const [docExpiry, setDocExpiry] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [docErr, setDocErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<Doc | null>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setDocErr("Choose a file to upload."); return; }
    setDocErr(null); setUploading(true); setProgress(0);
    try {
      // Direct-to-Blob (any file up to 20 MB), then persist the record.
      const up = await uploadToBlob(file, "staff-doc", { onProgress: setProgress });
      const res = await addStaffDocument(staffId, { type: docType, expiry: docExpiry || null, fileUrl: up.url, pathname: up.pathname });
      if (!res?.ok) { setDocErr(res?.error ?? "Could not save the document."); return; }
      if (fileRef.current) fileRef.current.value = "";
      setDocExpiry("");
      router.refresh();
    } catch { setDocErr("Upload failed. Please try again."); } finally { setUploading(false); }
  }
  const removeDoc = (id: string) => start(async () => { await deleteStaffDocument(id); router.refresh(); });

  // ── leave ──
  const [ls, setLs] = useState(""); const [le, setLe] = useState(""); const [lt, setLt] = useState("ANNUAL"); const [ln, setLn] = useState("");
  const [leaveErr, setLeaveErr] = useState<string | null>(null);
  function addLeave() {
    if (!ls || !le) { setLeaveErr("Pick start and end dates."); return; }
    setLeaveErr(null);
    start(async () => {
      try { await addStaffLeave(staffId, { startDate: ls, endDate: le, type: lt, note: ln || null }); setLs(""); setLe(""); setLn(""); router.refresh(); }
      catch (e) { setLeaveErr(e instanceof Error ? e.message : "Could not add leave."); }
    });
  }
  const removeLeave = (id: string) => start(async () => { await deleteStaffLeave(id); router.refresh(); });

  const input = "rounded-lg border border-ink-line bg-ink-card px-2 py-1.5 text-sm text-cream outline-none focus:border-gold/60";

  return (
    <div className={cn("grid gap-4", canViewDocs && "lg:grid-cols-2")}>
      {/* Documents — owner only */}
      {canViewDocs && (
      <div className="surface rounded-2xl p-5">
        <div className="mb-3 flex items-center gap-2"><FileText size={16} className="text-gold" /><h3 className="font-display text-lg text-cream">Documents</h3></div>
        <div className="space-y-2 rounded-xl border border-ink-line/60 bg-ink-card/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className={input}>
              {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input ref={fileRef} type="file" className="max-w-[9rem] text-xs text-sand file:mr-2 file:rounded file:border-0 file:bg-gold/15 file:px-2 file:py-1 file:text-gold" />
            <label className="text-xs text-muted">Expiry <input type="date" value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} className={cn(input, "ml-1 text-xs")} /></label>
            <button onClick={upload} disabled={uploading} className="inline-flex items-center gap-1 rounded-lg bg-gold-gradient px-3 py-1.5 text-xs font-semibold text-espresso disabled:opacity-50">
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {uploading ? (progress > 0 ? `${progress}%` : "…") : "Upload"}
            </button>
          </div>
          {uploading && progress > 0 && <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-line"><div className="h-full rounded-full bg-gold-gradient transition-all" style={{ width: `${Math.max(6, progress)}%` }} /></div>}
          {docErr && <p className="text-xs text-red-600">{docErr}</p>}
        </div>
        <ul className="mt-3 divide-y divide-ink-line/50">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <button type="button" onClick={() => setPreview(d)} className="inline-flex min-w-0 items-center gap-1.5 text-cream hover:text-gold hover:underline" title="Open document">
                <Eye size={13} className="shrink-0 text-gold/70" /> <span className="truncate">{typeLabel(d.type)}</span>
              </button>
              <div className="flex items-center gap-3">
                {d.expiry && (
                  <span className={cn("text-xs", expiringSoon(d.expiry) ? "text-red-600" : "text-muted")}>
                    {expiringSoon(d.expiry) && <AlertTriangle size={11} className="mr-1 inline" />}exp {fmtDate(d.expiry)}
                  </span>
                )}
                <button onClick={() => removeDoc(d.id)} disabled={pending} aria-label="Remove document" className="-m-2 p-2 text-muted hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </li>
          ))}
          {documents.length === 0 && <li className="py-3 text-center text-xs text-muted">No documents uploaded.</li>}
        </ul>
      </div>
      )}

      {/* Leave */}
      <div className="surface rounded-2xl p-5">
        <div className="mb-3 flex items-center gap-2"><Plane size={16} className="text-gold" /><h3 className="font-display text-lg text-cream">Leave</h3></div>
        <div className="mb-3 flex items-center gap-4 rounded-xl border border-ink-line/60 bg-ink-card/40 p-3 text-sm">
          {summary.eligible ? (
            <>
              <div><span className="font-display text-2xl text-gold-gradient">{summary.remaining}</span> <span className="text-xs text-muted">days left</span></div>
              <div className="text-xs text-muted">{summary.taken} taken · {summary.entitlement}/yr</div>
            </>
          ) : (
            <div className="text-xs text-muted">Not yet eligible for annual leave (accrues after 12 months). Sick/unpaid leave can still be logged.</div>
          )}
        </div>
        <div className="space-y-2 rounded-xl border border-ink-line/60 bg-ink-card/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted">From <input type="date" value={ls} onChange={(e) => setLs(e.target.value)} className={cn(input, "ml-1 text-xs")} /></label>
            <label className="text-xs text-muted">To <input type="date" value={le} onChange={(e) => setLe(e.target.value)} className={cn(input, "ml-1 text-xs")} /></label>
            <select value={lt} onChange={(e) => setLt(e.target.value)} className={input}>
              <option value="ANNUAL">Annual</option><option value="SICK">Sick</option><option value="UNPAID">Unpaid</option>
            </select>
            <button onClick={addLeave} disabled={pending} className="rounded-lg bg-gold-gradient px-3 py-1.5 text-xs font-semibold text-espresso disabled:opacity-50">Add</button>
          </div>
          <input value={ln} onChange={(e) => setLn(e.target.value)} placeholder="Note (optional)" className={cn(input, "w-full")} />
          {leaveErr && <p className="text-xs text-red-600">{leaveErr}</p>}
          <p className="text-[0.7rem] text-muted">Tip: schedule leave outside peak periods (December, Ramadan, month-end summer).</p>
        </div>
        <ul className="mt-3 divide-y divide-ink-line/50">
          {leaves.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 text-cream">{fmtDate(l.startDate)} – {fmtDate(l.endDate)} <span className="text-xs text-muted">· {l.days}d · {l.type.toLowerCase()}{l.note ? ` · ${l.note}` : ""}</span></span>
              <button onClick={() => removeLeave(l.id)} disabled={pending} aria-label="Remove leave" className="-m-2 p-2 text-muted hover:text-red-600"><Trash2 size={14} /></button>
            </li>
          ))}
          {leaves.length === 0 && <li className="py-3 text-center text-xs text-muted">No leave recorded.</li>}
        </ul>
      </div>

      {preview && (
        <FilePreviewModal
          url={`/api/erp/staff-doc/${preview.id}?inline=1`}
          downloadUrl={`/api/erp/staff-doc/${preview.id}`}
          kind={preview.kind}
          title={`${typeLabel(preview.type)} — staff document`}
          details={[
            { label: "Type", value: typeLabel(preview.type), strong: true },
            ...(preview.expiry ? [{ label: "Expiry", value: fmtDate(preview.expiry) } as PreviewDetail] : []),
            { label: "Uploaded", value: fmtDate(preview.uploadedAt) },
          ]}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
