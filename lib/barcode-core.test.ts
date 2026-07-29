import { test } from "node:test";
import assert from "node:assert/strict";
import { code39 } from "./barcode-core";

test("code39: wraps in start/stop guards and produces bars", () => {
  const bc = code39("123", 1, 3);
  assert.ok(bc.bars.length > 0);
  assert.ok(bc.width > 0);
  // every char (5 incl. the two *) has 5 bars → 25 bars total
  assert.equal(bc.bars.length, 5 * 5);
});

test("code39: width scales with narrow module size", () => {
  const a = code39("QA-1", 1, 3);
  const b = code39("QA-1", 2, 3);
  assert.equal(b.width, a.width * 2);
});

test("code39: drops unsupported characters (e.g. lowercase already upper, symbols)", () => {
  // '@' is unsupported and dropped; uppercase 'AB' kept → same as encoding "AB"
  assert.equal(code39("A@B").width, code39("AB").width);
});

test("code39: bars never overlap and stay within width", () => {
  const { bars, width } = code39("QA-202607-0291");
  for (let i = 1; i < bars.length; i++) {
    assert.ok(bars[i].x >= bars[i - 1].x + bars[i - 1].w, "bars are ordered and non-overlapping");
  }
  const last = bars[bars.length - 1];
  assert.ok(last.x + last.w <= width);
});
