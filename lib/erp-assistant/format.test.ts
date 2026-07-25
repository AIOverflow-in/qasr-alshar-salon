import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAnswer, rangeLabel } from "./format.ts";

test("rangeLabel renders named windows and explicit ranges", () => {
  assert.equal(rangeLabel({ range: "today" }), "today");
  assert.equal(rangeLabel({ range: "month" }), "this month");
  assert.equal(rangeLabel({ range: "week" }), "the last 7 days");
  assert.match(rangeLabel({ from: "2026-06-01", to: "2026-06-30" }), /Jun 2026.*Jun 2026/);
  assert.match(rangeLabel({ date: "2026-07-04" }), /4 Jul 2026/);
});

test("takings answer contains only the given figures + method split", () => {
  const a = formatAnswer("takings", { window: { range: "today" }, total: 1575, net: 1500, vat: 75, count: 3, byMethod: { CASH: 1000, CARD: 500, TRANSFER: 75 } });
  assert.match(a, /AED 1,575/); // aed() groups thousands
  assert.match(a, /net AED 1,500 \+ VAT AED 75/);
  assert.match(a, /Cash AED 1,000 · Card AED 500 · Transfer AED 75/);
  assert.match(a, /3 bills/);
});

test("takings with no sales reads cleanly", () => {
  assert.match(formatAnswer("takings", { window: { range: "yesterday" }, count: 0 }), /No paid sales yesterday\./);
});

test("top services lists ranked rows with real numbers", () => {
  const a = formatAnswer("top_services", { window: { range: "month" }, rows: [{ name: "Knotless Braids", qty: 12, revenue: 3156 }, { name: "Soft Glam", qty: 4, revenue: 2940 }] });
  assert.match(a, /1\. Knotless Braids — 12 sold, AED 3,156/);
  assert.match(a, /2\. Soft Glam — 4 sold, AED 2,940/);
});

test("low stock: happy path and empty path", () => {
  assert.match(formatAnswer("low_stock", { rows: [{ name: "Shampoo", qty: 1, reorderAt: 5 }] }), /Shampoo — 1 left \(reorder at 5\)/);
  assert.match(formatAnswer("low_stock", { rows: [] }), /Nothing is low on stock/);
});

test("expenses summary shows category breakdown + total", () => {
  const a = formatAnswer("expenses_summary", { window: { range: "month" }, total: 8000, rows: [{ category: "RENT", total: 6000 }, { category: "SUPPLIES", total: 2000 }] });
  assert.match(a, /Expenses — this month: AED 8,000/);
  assert.match(a, /Rent — AED 6,000/);
  assert.match(a, /Supplies — AED 2,000/);
});

test("bookings summary counts by status + upcoming", () => {
  const a = formatAnswer("bookings_summary", { window: { range: "week" }, byStatus: { CONFIRMED: 5, COMPLETED: 3, NO_SHOW: 1 }, total: 9, upcoming: 5 });
  assert.match(a, /Bookings — the last 7 days: 9/);
  assert.match(a, /No Show 1/);
  assert.match(a, /Upcoming confirmed: 5/);
});

test("top clients ranks by spend", () => {
  const a = formatAnswer("top_clients", { rows: [{ name: "Aisha", visits: 8, spent: 4200 }, { name: "Mariam", visits: 1, spent: 735 }] });
  assert.match(a, /1\. Aisha — AED 4,200 over 8 visits/);
  assert.match(a, /2\. Mariam — AED 735 over 1 visit\b/); // singular
});
