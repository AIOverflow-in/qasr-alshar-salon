import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { csvFile } from "./csv-core.ts";

/**
 * Every ERP spreadsheet the salon downloads goes through one encoder so they behave the same in
 * Excel. These pin the two things that were inconsistent across the five exports.
 */
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const EXPORTS = [
  "../app/api/erp/sales/export/route.ts",
  "../app/api/erp/expenses/export/route.ts",
  "../app/api/erp/inventory/export/route.ts",
  "../app/api/erp/payroll/export/route.ts",
];

test("csvFile prefixes a UTF-8 BOM so Excel does not mangle accented or Arabic names", () => {
  const out = csvFile(["name", "Jonté"]);
  assert.equal(out.charCodeAt(0), 0xfeff);
  assert.ok(out.includes("Jonté"));
});

test("a BOM cannot break the inventory round-trip", () => {
  // The importer lowercases and trims each header; JS treats U+FEFF as whitespace, so trim() eats it.
  const header = csvFile(["name,category,qty"]).split("\n")[0];
  const cols = header.split(",").map((h) => h.trim().toLowerCase());
  assert.equal(cols.indexOf("name"), 0, "a re-uploaded Excel file must still match its columns");
});

test("every CSV export goes through the shared encoder", () => {
  for (const f of EXPORTS) {
    assert.ok(read(f).includes("csvFile("), `${f} must not assemble its own CSV body`);
  }
  assert.ok(read("./pl-core.ts").includes('"\\uFEFF"'), "the P&L CSV needs the BOM too");
});

test("TOTAL sits in the first column, not inside a data column", () => {
  const sales = read("../app/api/erp/sales/export/route.ts");
  assert.ok(/lines\.push\(\["TOTAL"/.test(sales), 'sales TOTAL was in the "Payment" column');
  const exp = read("../app/api/erp/expenses/export/route.ts");
  assert.ok(/rows\.push\(\["TOTAL"/.test(exp), 'expenses TOTAL was in the "Invoice #" column');
});

test("the inventory headers stay lowercase — they are an import contract", () => {
  const inv = read("../app/api/erp/inventory/export/route.ts");
  assert.ok(inv.includes('["name", "category", "barcode", "qty", "costAED", "saleAED", "reorderAt"]'),
    "renaming these silently breaks the stock-take round-trip through /api/erp/inventory/import");
});

test("the pay rule is stated where salary and commission are read and set", () => {
  assert.ok(/higher/i.test(read("../components/erp/PayrollTable.tsx")), "the salary board must explain the floor");
  assert.ok(/floor/i.test(read("../components/erp/AddStaffForm.tsx")), "so must the add-staff form");
  assert.ok(/FLOOR/.test(read("../components/erp/StaffEditRow.tsx")), "and the inline salary editor");
});
