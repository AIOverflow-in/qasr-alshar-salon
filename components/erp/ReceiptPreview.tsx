"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import { FilePreviewModal, type PreviewDetail } from "./FilePreviewModal";

/**
 * A "receipt" chip that opens the side-by-side preview (receipt image/PDF + the
 * expense details). Drop-in replacement for the old plain download link.
 */
export function ReceiptPreview({ url, title, details }: { url: string; title: string; details: PreviewDetail[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-0.5 text-gold hover:underline"
      >
        <Paperclip size={11} /> receipt
      </button>
      {open && <FilePreviewModal url={url} title={title} details={details} onClose={() => setOpen(false)} />}
    </>
  );
}
