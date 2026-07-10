"use client";

import { useEffect } from "react";
import { X, Download, ExternalLink, FileText } from "lucide-react";
import { previewKind, type PreviewKind } from "@/lib/file-preview-core";

export type PreviewDetail = { label: string; value: string; strong?: boolean };

/**
 * Side-by-side document preview: the file (image / PDF) on one side and its
 * details on the other. Closes on Escape or backdrop click; stacks vertically on
 * phones. Used for expense receipts (public Blob) and — via a safe inline serve
 * route — private company/staff documents.
 *
 * `kind` lets the caller pin how to render when `url` has no extension (e.g. a
 * stream route like /api/erp/staff-doc/[id]?inline=1); otherwise it's inferred
 * from the URL. `downloadUrl` is the download (attachment) variant of the file —
 * defaults to `url` when the same link serves both.
 */
export function FilePreviewModal({
  url,
  downloadUrl,
  title,
  details,
  kind,
  onClose,
}: {
  url: string;
  downloadUrl?: string;
  title: string;
  details: PreviewDetail[];
  kind?: PreviewKind;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const resolvedKind = kind ?? previewKind(url);
  const dl = downloadUrl ?? url;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="mt-2 grid w-full max-w-5xl overflow-hidden rounded-2xl border border-ink-line bg-ink shadow-2xl sm:mt-6 md:grid-cols-[1fr_320px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* File pane */}
        <div className="flex min-h-[45vh] items-center justify-center bg-black/40 p-3 md:min-h-[70vh]">
          {resolvedKind === "image" ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={url} alt={title} className="max-h-[80vh] w-full object-contain" />
          ) : resolvedKind === "pdf" ? (
            <iframe src={url} title={title} className="h-[70vh] w-full rounded-lg bg-white md:h-full" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted">
              <FileText size={40} />
              <p className="text-sm">Preview not available for this file type.</p>
            </div>
          )}
        </div>

        {/* Details pane */}
        <div className="flex flex-col border-t border-ink-line md:border-l md:border-t-0">
          <div className="flex items-center justify-between gap-2 border-b border-ink-line p-4">
            <h3 className="min-w-0 truncate font-display text-lg text-cream">{title}</h3>
            <button onClick={onClose} aria-label="Close preview" className="-m-2 shrink-0 p-2 text-muted hover:text-cream"><X size={18} /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {details.map((d) => (
              <div key={d.label}>
                <div className="text-[0.7rem] uppercase tracking-wide text-muted">{d.label}</div>
                <div className={d.strong ? "text-base font-semibold text-gold" : "text-sm text-cream"}>{d.value}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-ink-line p-4">
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink-line px-3 py-2 text-sm text-sand hover:border-gold/50 hover:text-gold"><ExternalLink size={14} /> Open</a>
            <a href={dl} download className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gold-gradient px-3 py-2 text-sm font-semibold text-espresso"><Download size={14} /> Download</a>
          </div>
        </div>
      </div>
    </div>
  );
}
