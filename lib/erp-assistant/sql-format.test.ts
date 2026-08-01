import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRows, formatValue, labelFor } from "./sql-format";

test("no rows reads as an answer, not an error", () => {
  assert.equal(formatRows("Clients in June", []), "**Clients in June:** no matching records.");
});

test("single scalar is rendered inline, money as AED", () => {
  assert.equal(formatRows("June takings", [{ total: 12400 }]), "**June takings:** AED 12,400");
  assert.equal(formatRows("Clients", [{ count: 37 }]), "**Clients:** 37");
});

test("one record renders as bullets", () => {
  const out = formatRows("Top artist", [{ name: "Amina", totalAED: 8200 }]);
  assert.match(out, /\*\*Top artist\*\*/);
  assert.match(out, /• Name — Amina/);
  assert.match(out, /• Total — AED 8,200/);
});

test("several records render as a numbered list with the first column as the label", () => {
  const out = formatRows("Top services", [
    { name: "Braids", revenueAED: 5000 },
    { name: "Makeup", revenueAED: 3000 },
  ]);
  assert.match(out, /1\. \*\*Braids\*\* — Revenue: AED 5,000/);
  assert.match(out, /2\. \*\*Makeup\*\* — Revenue: AED 3,000/);
});

test("long lists are truncated with a note", () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ name: `C${i}`, n: i }));
  const out = formatRows("Clients", rows, true);
  assert.match(out, /showing the first 25/);
});

test("money detection: AED columns and money-ish names", () => {
  assert.equal(formatValue("totalAED", 1200), "AED 1,200");
  assert.equal(formatValue("salaryAED", 4000), "AED 4,000");
  assert.equal(formatValue("commission", 250), "AED 250");
  assert.equal(formatValue("visits", 12), "12"); // not money
});

test("dates, booleans and nulls", () => {
  assert.equal(formatValue("createdAt", "2026-06-01"), "1 Jun 2026");
  assert.equal(formatValue("active", true), "yes");
  assert.equal(formatValue("paidAt", null), "—");
});

test("labels are humanised", () => {
  assert.equal(labelFor("totalAED"), "Total");
  assert.equal(labelFor("staff_name"), "Staff name");
  assert.equal(labelFor("clientId"), "Client id");
});

test("very long cells and answers are clipped", () => {
  assert.ok(formatValue("notes", "x".repeat(400)).length <= 121);
  const rows = Array.from({ length: 25 }, (_, i) => ({ name: "y".repeat(110), v: i }));
  assert.ok(formatRows("Big", rows).length <= 1801);
});
