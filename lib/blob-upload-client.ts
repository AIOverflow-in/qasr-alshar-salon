"use client";
import { upload } from "@vercel/blob/client";
import { uploadPathname, contentTypeFor, MAX_UPLOAD_BYTES, type UploadKind } from "./upload-core";

export type UploadedFile = { url: string; pathname: string; name: string; size: number };

// Downscale big JPEG/PNG/WEBP photos in the browser before upload (faster, less
// storage). Best-effort: HEIC / PDFs / odd types or any error fall back to the
// original file untouched — so "any file works" always holds.
async function maybeCompress(file: File): Promise<File> {
  const compressible = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (!compressible || file.size < 1_200_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const MAX_EDGE = 2000;
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file; // no gain → keep the original
    return new File([blob], file.name.replace(/\.(png|webp|jpeg)$/i, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/**
 * Upload a file straight to Vercel Blob (bypasses the 4.5 MB serverless limit).
 * Throws on genuine failure so the caller can decide (e.g. save the expense
 * anyway and offer a retry). Returns the public Blob URL + pathname.
 */
export async function uploadToBlob(
  file: File,
  kind: UploadKind,
  opts?: { onProgress?: (pct: number) => void },
): Promise<UploadedFile> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("That file is over 20 MB — please choose a smaller one.");
  const toSend = await maybeCompress(file);
  const blob = await upload(uploadPathname(kind, toSend.name), toSend, {
    access: "public",
    handleUploadUrl: "/api/erp/blob-upload",
    clientPayload: JSON.stringify({ kind }),
    contentType: contentTypeFor(toSend.name, toSend.type),
    onUploadProgress: opts?.onProgress ? (e) => opts.onProgress!(Math.round(e.percentage)) : undefined,
  });
  return { url: blob.url, pathname: blob.pathname, name: toSend.name, size: toSend.size };
}
