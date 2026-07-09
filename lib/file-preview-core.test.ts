import { test } from "node:test";
import assert from "node:assert/strict";
import { previewKind } from "./file-preview-core.ts";

test("previewKind detects images, pdf, other — ignoring query strings", () => {
  assert.equal(previewKind("https://x.blob/expense-receipts/a-b.png"), "image");
  assert.equal(previewKind("receipt.JPG"), "image");
  assert.equal(previewKind("https://x.blob/r.webp?token=abc"), "image");
  assert.equal(previewKind("invoice-2026.pdf"), "pdf");
  assert.equal(previewKind("https://x.blob/scan.pdf#page=2"), "pdf");
  assert.equal(previewKind("notes.txt"), "other");
  assert.equal(previewKind("noextension"), "other");
});
