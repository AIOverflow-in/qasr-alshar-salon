import { test } from "node:test";
import assert from "node:assert/strict";
import { vatFromInclusive, netFromInclusive, grossFromNet } from "./vat-core.ts";

test("vatFromInclusive extracts the VAT contained in a gross total", () => {
  assert.equal(vatFromInclusive(315), 15);   // net 300 + 15
  assert.equal(vatFromInclusive(263), 13);   // 263 - 250.48 → 13
  assert.equal(vatFromInclusive(105), 5);
  assert.equal(vatFromInclusive(0), 0);
});

test("netFromInclusive + vatFromInclusive always sum back to the total", () => {
  for (const total of [315, 263, 105, 1575, 2100, 189, 231, 1, 999]) {
    assert.equal(netFromInclusive(total) + vatFromInclusive(total), total);
  }
});

test("grossFromNet applies +5% rounded to the nearest AED (menu migration)", () => {
  assert.equal(grossFromNet(300), 315);
  assert.equal(grossFromNet(250), 263);   // 262.5 → 263
  assert.equal(grossFromNet(350), 368);   // 367.5 → 368
  assert.equal(grossFromNet(150), 158);   // 157.5 → 158
  assert.equal(grossFromNet(1500), 1575);
  assert.equal(grossFromNet(2000), 2100);
});

test("round-trip is close: net → gross → net stays within 1 AED", () => {
  for (const net of [300, 250, 350, 150, 220, 180, 260, 1500]) {
    const gross = grossFromNet(net);
    assert.ok(Math.abs(netFromInclusive(gross) - net) <= 1, `net ${net} → gross ${gross} → net ${netFromInclusive(gross)}`);
  }
});
