import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateMonthly, monIndex, type OrderRow } from "./analytics-core.ts";

const catByName = new Map([
  ["Hair Colour", "Colour"],
  ["Cut & Style", "Styling"],
]);

const order = (o: Partial<OrderRow> & Pick<OrderRow, "totalAED" | "createdAt">): OrderRow => ({
  subtotalAED: 0, vatAED: 0, paymentMethod: "CARD", splitPayment: false, cashAED: 0, cardAED: 0, transferAED: 0, lines: [], ...o,
});

const at = (iso: string) => new Date(iso); // ISO with +04:00 offset in the string

const ORDERS: OrderRow[] = [
  order({ totalAED: 500, subtotalAED: 476, vatAED: 24, createdAt: at("2026-07-01T09:00:00+04:00"), paymentMethod: "CARD",
    lines: [{ kind: "SERVICE", description: "Hair Colour", lineAED: 300 }, { kind: "SERVICE", description: "Cut & Style", lineAED: 200 }] }),
  order({ totalAED: 200, subtotalAED: 190, vatAED: 10, createdAt: at("2026-07-01T18:00:00+04:00"), paymentMethod: "CASH",
    lines: [{ kind: "PRODUCT", description: "Shampoo", lineAED: 200 }] }),
  order({ totalAED: 300, subtotalAED: 286, vatAED: 14, createdAt: at("2026-07-05T12:00:00+04:00"), splitPayment: true, cashAED: 100, cardAED: 150, transferAED: 50,
    lines: [{ kind: "SERVICE", description: "Hair Colour", lineAED: 300 }] }),
  order({ totalAED: 100, subtotalAED: 95, vatAED: 5, createdAt: at("2026-07-05T15:00:00+04:00"), paymentMethod: "TRANSFER",
    lines: [{ kind: "SERVICE", description: "Threading", lineAED: 100 }] }),
];

const run = () => aggregateMonthly(ORDERS, catByName, { monthKey: "2026-07", now: at("2026-07-06T10:00:00+04:00") });

test("totals: gross/net/vat/count", () => {
  const a = run();
  assert.equal(a.total, 1100);
  assert.equal(a.net, 1047);
  assert.equal(a.vat, 53);
  assert.equal(a.count, 4);
});

test("month context: days-in-month + label", () => {
  const a = run();
  assert.equal(a.daysInMonth, 31);
  assert.equal(a.monthLabel, "July 2026");
  assert.equal(a.todayDom, 6);
});

test("payment mix splits correctly (single + split bills)", () => {
  const a = run();
  assert.equal(a.byMethod.CARD, 650); // 500 single + 150 split card
  assert.equal(a.byMethod.CASH, 300); // 200 single + 100 split cash
  assert.equal(a.byMethod.TRANSFER, 150); // 50 split + 100 single
  assert.equal(a.byMethod.CARD + a.byMethod.CASH + a.byMethod.TRANSFER, a.total);
});

test("category build-up maps service→category, products→Retail, unknown→Other", () => {
  const a = run();
  const by = Object.fromEntries(a.byCategory.map((c) => [c.name, c.amount]));
  assert.equal(by.Colour, 600); // 300 + 300
  assert.equal(by.Styling, 200);
  assert.equal(by.Retail, 200); // product line
  assert.equal(by.Other, 100); // Threading not in the map
  assert.equal(a.topCategory.name, "Colour");
  assert.equal(a.topCategory.amount, 600);
});

test("by-day heat + derived day stats", () => {
  const a = run();
  assert.equal(a.byDay.length, 31);
  assert.equal(a.byDay[0].amount, 700); // 1 Jul: 500 + 200
  assert.equal(a.byDay[4].amount, 400); // 5 Jul: 300 + 100
  assert.deepEqual(a.hottestDay, { day: 1, amount: 700 });
  assert.equal(a.daysTraded, 2);
  assert.equal(a.avgActiveDay, 550); // 1100 / 2
});

test("weekday rhythm totals reconcile to gross", () => {
  const a = run();
  assert.equal(a.byWeekday.length, 7);
  assert.equal(a.byWeekday.reduce((s, d) => s + d.amount, 0), 1100);
  assert.equal(a.strongestWeekday.amount, 700); // the 1 Jul weekday
});

test("empty month is safe (no NaN / no throw)", () => {
  const a = aggregateMonthly([], catByName, { monthKey: "2026-02", now: at("2026-02-10T10:00:00+04:00") });
  assert.equal(a.total, 0);
  assert.equal(a.count, 0);
  assert.equal(a.daysTraded, 0);
  assert.equal(a.avgActiveDay, 0);
  assert.equal(a.daysInMonth, 28); // Feb 2026
  assert.deepEqual(a.hottestDay, { day: 0, amount: 0 });
  assert.equal(a.topCategory.name, "—");
});

test("monIndex maps Monday→0 … Sunday→6", () => {
  assert.equal(monIndex("2026-07-06"), 0); // Monday
  assert.equal(monIndex("2026-07-05"), 6); // Sunday
});
