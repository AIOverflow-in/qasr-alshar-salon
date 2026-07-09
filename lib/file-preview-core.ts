// Pure helper for the document/receipt preview — unit-tested in file-preview-core.test.ts.

export type PreviewKind = "image" | "pdf" | "other";

/** Infer how to render a file from its URL/name (extension, ignoring any query string). */
export function previewKind(urlOrName: string): PreviewKind {
  const ext = (String(urlOrName).split(/[?#]/)[0].split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}
