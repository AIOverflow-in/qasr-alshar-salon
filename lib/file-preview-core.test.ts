import { test } from "node:test";
import assert from "node:assert/strict";
import { previewKind, inlineContentType, inlineKind } from "./file-preview-core.ts";

test("previewKind detects images, pdf, other — ignoring query strings", () => {
  assert.equal(previewKind("https://x.blob/expense-receipts/a-b.png"), "image");
  assert.equal(previewKind("receipt.JPG"), "image");
  assert.equal(previewKind("https://x.blob/r.webp?token=abc"), "image");
  assert.equal(previewKind("invoice-2026.pdf"), "pdf");
  assert.equal(previewKind("https://x.blob/scan.pdf#page=2"), "pdf");
  assert.equal(previewKind("notes.txt"), "other");
  assert.equal(previewKind("noextension"), "other");
});

test("inlineContentType returns a safe MIME only for images (non-SVG) and PDF", () => {
  assert.equal(inlineContentType("passport.jpg"), "image/jpeg");
  assert.equal(inlineContentType("scan.JPEG"), "image/jpeg");
  assert.equal(inlineContentType("id.png"), "image/png");
  assert.equal(inlineContentType("photo.webp"), "image/webp");
  assert.equal(inlineContentType("vat-return.pdf"), "application/pdf");
  assert.equal(inlineContentType("https://x.blob/staff-docs/a-b.pdf?tok=1"), "application/pdf");
});

test("inlineContentType refuses SVG and office/text formats (download-only)", () => {
  // SVG can carry script — never inline it on the ERP origin.
  assert.equal(inlineContentType("logo.svg"), null);
  assert.equal(inlineContentType("lease.docx"), null);
  assert.equal(inlineContentType("sheet.xlsx"), null);
  assert.equal(inlineContentType("notes.txt"), null);
  assert.equal(inlineContentType("page.html"), null);
  assert.equal(inlineContentType("noext"), null);
});

test("inlineKind maps to how the modal renders (image / pdf / other=download)", () => {
  assert.equal(inlineKind("id.png"), "image");
  assert.equal(inlineKind("scan.pdf"), "pdf");
  assert.equal(inlineKind("logo.svg"), "other"); // svg is download-only, not shown inline
  assert.equal(inlineKind("lease.docx"), "other");
  assert.equal(inlineKind(""), "other");
});
