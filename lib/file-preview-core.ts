// Pure helpers for the document/receipt preview — unit-tested in file-preview-core.test.ts.

export type PreviewKind = "image" | "pdf" | "other";

/** Lower-cased file extension from a URL or name, ignoring any query string / hash. */
function extOf(urlOrName: string): string {
  return (String(urlOrName).split(/[?#]/)[0].split(".").pop() || "").toLowerCase();
}

/** Infer how to render a file from its URL/name (used for public-Blob receipts). */
export function previewKind(urlOrName: string): PreviewKind {
  const ext = extOf(urlOrName);
  if (["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

// Content types we are willing to serve INLINE from the ERP origin so a private
// document can be previewed in-app. Deliberately EXCLUDES svg (can carry script)
// and every office/text format — those stay download-only. Served with the real
// type + `X-Content-Type-Options: nosniff`, so the browser renders it as an image
// or PDF and it can never be interpreted/executed as HTML/JS on our origin.
const INLINE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  bmp: "image/bmp",
  pdf: "application/pdf",
};

/** The safe inline MIME type for a file, or null if it must stay download-only. */
export function inlineContentType(urlOrName: string): string | null {
  return INLINE_MIME[extOf(urlOrName)] ?? null;
}

/** How the preview modal should render an inline-safe file ("other" = show download only). */
export function inlineKind(urlOrName: string): PreviewKind {
  const ct = inlineContentType(urlOrName);
  if (!ct) return "other";
  return ct === "application/pdf" ? "pdf" : "image";
}
