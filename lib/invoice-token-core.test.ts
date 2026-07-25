import { test } from "node:test";
import assert from "node:assert/strict";
import { signInvoiceToken, verifyInvoiceTokenWith } from "./invoice-token-core";

const SECRET = "test-secret-at-least-thirty-two-chars-long";
const OTHER = "another-secret-also-thirty-two-chars-min!!";

test("signInvoiceToken is deterministic, 24 hex chars", () => {
  const t = signInvoiceToken("INV-1001", SECRET);
  assert.match(t, /^[0-9a-f]{24}$/);
  assert.equal(t, signInvoiceToken("INV-1001", SECRET)); // stable
});

test("signInvoiceToken varies by invoice number and by secret", () => {
  assert.notEqual(signInvoiceToken("INV-1001", SECRET), signInvoiceToken("INV-1002", SECRET));
  assert.notEqual(signInvoiceToken("INV-1001", SECRET), signInvoiceToken("INV-1001", OTHER));
});

test("verifyInvoiceTokenWith accepts a genuine token", () => {
  const t = signInvoiceToken("INV-1001", SECRET);
  assert.equal(verifyInvoiceTokenWith("INV-1001", t, SECRET), true);
});

test("verifyInvoiceTokenWith rejects tampered, wrong-length, and wrong-secret tokens", () => {
  const t = signInvoiceToken("INV-1001", SECRET);
  const flipped = (t[0] === "a" ? "b" : "a") + t.slice(1); // same length, one char off
  assert.equal(verifyInvoiceTokenWith("INV-1001", flipped, SECRET), false);
  assert.equal(verifyInvoiceTokenWith("INV-1001", "deadbeef", SECRET), false); // wrong length
  assert.equal(verifyInvoiceTokenWith("INV-1001", t, OTHER), false);           // wrong secret
  assert.equal(verifyInvoiceTokenWith("INV-9999", t, SECRET), false);          // wrong invoice
});
