import { test } from "node:test";
import assert from "node:assert/strict";
import { isUploadKind, canUpload, uploadPathname, contentTypeFor, MAX_UPLOAD_BYTES } from "./upload-core.ts";

test("isUploadKind guards the known kinds", () => {
  assert.ok(isUploadKind("receipt"));
  assert.ok(isUploadKind("staff-doc"));
  assert.ok(!isUploadKind("evil"));
  assert.ok(!isUploadKind(123));
});

test("canUpload enforces per-kind roles", () => {
  assert.ok(canUpload("receipt", "RECEPTION"));        // reception logs expenses
  assert.ok(!canUpload("company-doc", "RECEPTION"));   // vault is owner-only
  assert.ok(!canUpload("staff-doc", "ADMIN"));         // staff docs are owner-only
  assert.ok(canUpload("staff-doc", "SUPER_ADMIN"));
  assert.ok(canUpload("product-image", "ADMIN"));
  assert.ok(!canUpload("receipt", "STYLIST"));
});

test("uploadPathname prefixes by kind and sanitizes the name", () => {
  assert.equal(uploadPathname("receipt", "my receipt!.jpg"), "expense-receipts/my_receipt_.jpg");
  assert.equal(uploadPathname("staff-doc", "../../etc/passwd"), "staff-docs/.._.._etc_passwd");
  assert.ok(uploadPathname("receipt", "").startsWith("expense-receipts/"));
});

test("contentTypeFor prefers the browser type, else infers from extension (HEIC)", () => {
  assert.equal(contentTypeFor("x.pdf", "application/pdf"), "application/pdf");
  assert.equal(contentTypeFor("IMG_1.heic", ""), "image/heic");   // iPhone photo, empty browser type
  assert.equal(contentTypeFor("scan.PNG", undefined), "image/png");
  assert.equal(contentTypeFor("weird.xyz", ""), "application/octet-stream");
});

test("max upload size is 20 MB", () => {
  assert.equal(MAX_UPLOAD_BYTES, 20 * 1024 * 1024);
});
