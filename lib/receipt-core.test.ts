import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReceipt, paymentLabel, receiptDateLabel, type ReceiptInput } from "./receipt-core";

const base: ReceiptInput = {
  invoiceNo: "QA-100123",
  createdAt: new Date("2026-07-27T09:30:00Z"),
  paymentMethod: "CASH",
  subtotalAED: 300, vatAED: 15, vatPct: 5, totalAED: 315,
  lines: [
    { description: "Knotless Braids", qty: 1, unitAED: 250, lineAED: 250, staffNames: ["Ada", "Bea"] },
    { description: "Deep Conditioning", qty: 2, unitAED: 32, lineAED: 65 },
  ],
  clientName: "Aisha",
};

test("buildReceipt maps lines, artist labels, item count, client", () => {
  const r = buildReceipt(base, false);
  assert.equal(r.invoiceNo, "QA-100123");
  assert.equal(r.clientName, "Aisha");
  assert.equal(r.itemCount, 3); // 1 + 2
  assert.equal(r.items[0].by, "Ada, Bea");
  assert.equal(r.items[1].by, undefined);
  assert.equal(r.totalAED, 315);
});

test("buildReceipt: VAT breakdown only when VAT-registered", () => {
  assert.equal(buildReceipt(base, false).showVat, false); // pre-registration → plain receipt
  assert.equal(buildReceipt(base, true).showVat, true);   // registered → tax invoice
});

test("buildReceipt: walk-in fallback when no client name", () => {
  assert.equal(buildReceipt({ ...base, clientName: null }, false).clientName, "Walk-in customer");
  assert.equal(buildReceipt({ ...base, clientName: "   " }, false).clientName, "Walk-in customer");
});

test("paymentLabel: single method is title-cased", () => {
  assert.equal(paymentLabel({ paymentMethod: "CASH" }), "Cash");
  assert.equal(paymentLabel({ paymentMethod: "CARD" }), "Card");
  assert.equal(paymentLabel({ paymentMethod: "TRANSFER" }), "Transfer");
});

test("paymentLabel: split lists each method with a non-zero amount", () => {
  const l = paymentLabel({ splitPayment: true, paymentMethod: "CASH", cashAED: 200, cardAED: 0, transferAED: 115 });
  assert.match(l, /^Split — /);
  assert.match(l, /Cash AED 200/);
  assert.match(l, /Transfer AED 115/);
  assert.doesNotMatch(l, /Card/); // zero card leg omitted
});

test("receiptDateLabel is Dubai-local and includes a time", () => {
  // 09:30 UTC = 13:30 Dubai (UTC+4)
  const s = receiptDateLabel(new Date("2026-07-27T09:30:00Z"));
  assert.match(s, /27 Jul 2026/);
  assert.match(s, /01:30\s*pm/i);
});
