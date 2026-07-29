import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReceipt, paymentRows, receiptDateLabel, type ReceiptInput } from "./receipt-core";

const base: ReceiptInput = {
  invoiceNo: "QA-100123",
  createdAt: new Date("2026-04-25T20:37:00Z"), // 26 Apr 00:37 Dubai
  paymentMethod: "CARD",
  totalAED: 3500,
  operatorName: "Sarah",
  salesMan: "Amina",
  clientName: null,
  lines: [
    { category: "Hair", description: "WIGS", qty: 1, unitAED: 3000, lineAED: 3000 },
    { category: "Make & Style", description: "Model Makeup", qty: 1, unitAED: 500, lineAED: 500 },
  ],
};

test("buildReceipt groups items by category in first-seen order", () => {
  const r = buildReceipt(base, { cardBank: "First Abu Dhabi Bank" });
  assert.equal(r.groups.length, 2);
  assert.equal(r.groups[0].category, "Hair");
  assert.equal(r.groups[0].items[0].name, "WIGS");
  assert.equal(r.groups[1].category, "Make & Style");
});

test("buildReceipt totals: item count, qty sum, net = total", () => {
  const r = buildReceipt(base);
  assert.equal(r.totalItems, 2);
  assert.equal(r.totalQty, 2);
  assert.equal(r.netAmountAED, 3500);
  assert.equal(r.totalAED, 3500);
});

test("buildReceipt: walk-in + operator/salesman fallbacks", () => {
  assert.equal(buildReceipt({ ...base, clientName: "   " }).clientName, "Walk-In");
  assert.equal(buildReceipt({ ...base, operatorName: null }).operatorName, "—");
  assert.equal(buildReceipt({ ...base, salesMan: "" }).salesMan, "—");
  assert.equal(buildReceipt({ ...base, clientName: "Aisha" }).clientName, "Aisha");
});

test("buildReceipt: lines with no category fall under 'Other'", () => {
  const r = buildReceipt({ ...base, lines: [{ description: "Misc", qty: 1, unitAED: 100, lineAED: 100 }] });
  assert.equal(r.groups[0].category, "Other");
});

test("paymentRows: single card payment carries the acquiring bank", () => {
  const rows = paymentRows({ paymentMethod: "CARD", totalAED: 3500 }, "First Abu Dhabi Bank");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].mode, "Credit Card");
  assert.equal(rows[0].detail, "First Abu Dhabi Bank");
  assert.equal(rows[0].amountAED, 3500);
});

test("paymentRows: cash has no bank detail", () => {
  const rows = paymentRows({ paymentMethod: "CASH", totalAED: 200 }, "First Abu Dhabi Bank");
  assert.equal(rows[0].mode, "Cash");
  assert.equal(rows[0].detail, "");
});

test("paymentRows: split lists each non-zero method with amount", () => {
  const rows = paymentRows({ splitPayment: true, paymentMethod: "CASH", cashAED: 200, cardAED: 0, transferAED: 115, totalAED: 315 }, "FAB");
  assert.equal(rows.length, 2); // card leg (0) dropped
  assert.deepEqual(rows.map((r) => r.mode), ["Cash", "Transfer"]);
  assert.equal(rows[1].detail, "FAB"); // transfer shows the bank
});

test("receiptDateLabel is Dubai-local with weekday + time", () => {
  const s = receiptDateLabel(new Date("2026-04-25T20:37:00Z"));
  assert.match(s, /Sun/);
  assert.match(s, /26 Apr 2026/);
  assert.match(s, /12:37\s*am/i);
});
