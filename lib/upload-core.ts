// Shared, pure config for direct-to-Blob uploads — used by the upload route
// (server) and the client helper. Unit-tested in upload-core.test.ts.
//
// Files upload straight from the browser to Vercel Blob (bypassing the 4.5 MB
// serverless request limit), so any photo or document up to 20 MB works.

export type UploadKind = "receipt" | "company-doc" | "staff-doc" | "product-image";

const IMAGE_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif",
];
// Any normal photo or document. Deliberately no image/svg+xml or text/html (script-carriers);
// octet-stream covers files the browser can't type. Private docs are served download-only anyway.
const DOC_TYPES = [
  ...IMAGE_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv",
  "application/octet-stream",
];

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

export const UPLOAD_KINDS: Record<UploadKind, { prefix: string; contentTypes: string[]; roles: string[] }> = {
  "receipt":       { prefix: "expense-receipts", contentTypes: DOC_TYPES,   roles: ["SUPER_ADMIN", "ADMIN", "RECEPTION"] },
  "company-doc":   { prefix: "company-docs",     contentTypes: DOC_TYPES,   roles: ["SUPER_ADMIN"] },
  "staff-doc":     { prefix: "staff-docs",       contentTypes: DOC_TYPES,   roles: ["SUPER_ADMIN"] },
  "product-image": { prefix: "product-images",   contentTypes: IMAGE_TYPES, roles: ["SUPER_ADMIN", "ADMIN"] },
};

export function isUploadKind(x: unknown): x is UploadKind {
  return typeof x === "string" && x in UPLOAD_KINDS;
}

/** Whether a role may upload files of this kind. */
export function canUpload(kind: UploadKind, role: string): boolean {
  return UPLOAD_KINDS[kind].roles.includes(role);
}

/** Build the storage pathname for a kind: "<prefix>/<sanitized-name>". */
export function uploadPathname(kind: UploadKind, filename: string): string {
  const safe = (filename || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
  return `${UPLOAD_KINDS[kind].prefix}/${safe}`;
}

/** Best-effort content type: use the browser's, else infer from the extension (HEIC etc.). */
export function contentTypeFor(filename: string, browserType?: string): string {
  if (browserType) return browserType;
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
    avif: "image/avif", heic: "image/heic", heif: "image/heif", pdf: "application/pdf",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv", txt: "text/plain",
  };
  return map[ext] ?? "application/octet-stream";
}
