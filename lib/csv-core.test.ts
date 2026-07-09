import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell } from "./csv-core.ts";

test("plain text passes through unquoted", () => {
  assert.equal(csvCell("Aya"), "Aya");
  assert.equal(csvCell("INV-1001"), "INV-1001");
  assert.equal(csvCell(""), "");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
});

test("quotes/commas/newlines are RFC-4180 quoted", () => {
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('he said "hi"'), '"he said ""hi"""');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
});

test("numbers pass through untouched — including negatives (no formula prefix)", () => {
  assert.equal(csvCell(0), "0");
  assert.equal(csvCell(1234), "1234");
  assert.equal(csvCell(-500), "-500"); // a deduction/negative net must NOT become '-500
  assert.equal(csvCell(12.5), "12.5");
});

test("formula-triggering TEXT cells are neutralized with a leading apostrophe", () => {
  // Real attack payload: prefixed with ' AND quoted (contains quotes + comma).
  assert.equal(csvCell('=HYPERLINK("http://evil","x")'), '"\'=HYPERLINK(""http://evil"",""x"")"');
  assert.equal(csvCell("=1+1"), "'=1+1");
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("-cmd|calc"), "'-cmd|calc");
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(csvCell("\tTabbed"), "'\tTabbed");
});

test("neutralized cell that also needs quoting is both prefixed and quoted", () => {
  // "=a,b" starts with a formula trigger AND contains a comma
  assert.equal(csvCell("=a,b"), '"\'=a,b"');
});

test("a string that merely CONTAINS but doesn't start with a trigger is left alone", () => {
  assert.equal(csvCell("A=B"), "A=B");
  assert.equal(csvCell("2+2 hair"), "2+2 hair");
});
