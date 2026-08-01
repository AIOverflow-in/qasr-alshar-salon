/**
 * Keeps the assistant's schema card honest as the database grows.
 *
 * If someone adds a model or a column to schema.prisma, this test FAILS until they either expose
 * it to the assistant or consciously exclude it. That forcing function — not the validator — is
 * what stops a future sensitive column (say Staff.bankAccountNumber) leaking by default.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { SCHEMA_TABLES, EXCLUDED_TABLES, schemaCardText } from "./schema-card";

const models = Prisma.dmmf.datamodel.models;
const bySpec = new Map(SCHEMA_TABLES.map((t) => [t.table, t]));

test("every Prisma model is either exposed or explicitly excluded", () => {
  const unaccounted = models
    .map((m) => m.name)
    .filter((n) => !bySpec.has(n) && !EXCLUDED_TABLES.has(n));
  assert.deepEqual(
    unaccounted, [],
    `New model(s) ${unaccounted.join(", ")} — add to SCHEMA_TABLES or EXCLUDED_TABLES in schema-card.ts`,
  );
});

test("every exposed table and column still exists in the datamodel", () => {
  for (const spec of SCHEMA_TABLES) {
    const model = models.find((m) => m.name === spec.table);
    assert.ok(model, `exposed table ${spec.table} no longer exists in schema.prisma`);
    const fields = new Set(model!.fields.map((f) => f.name));
    for (const col of spec.cols) {
      assert.ok(fields.has(col.n), `${spec.table}.${col.n} no longer exists in schema.prisma`);
    }
  }
});

test("every column of an exposed table is either shown or omitted on purpose", () => {
  for (const spec of SCHEMA_TABLES) {
    const model = models.find((m) => m.name === spec.table)!;
    const shown = new Set(spec.cols.map((x) => x.n));
    const omitted = new Set(spec.omit ?? []);
    const missed = model.fields
      // relation/list-of-relation fields are navigation, not data — never in the card
      .filter((f) => f.kind !== "object")
      .map((f) => f.name)
      .filter((n) => !shown.has(n) && !omitted.has(n));
    assert.deepEqual(
      missed, [],
      `${spec.table}: column(s) ${missed.join(", ")} — add to cols (safe) or omit (sensitive/noise) in schema-card.ts`,
    );
  }
});

test("secrets are never exposed", () => {
  const forbidden = [
    ["Staff", "passportNumber"], ["Staff", "emiratesId"], ["Staff", "labourCardNumber"],
    ["Staff", "labourPermitNumber"], ["Staff", "biometricPin"], ["Staff", "passportPicLink"],
  ] as const;
  for (const [table, col] of forbidden) {
    const spec = bySpec.get(table);
    if (!spec) continue;
    assert.ok(!spec.cols.some((c) => c.n === col), `${table}.${col} must never be exposed`);
  }
  assert.ok(EXCLUDED_TABLES.has("AdminUser"), "AdminUser holds passwordHash — must stay excluded");
  assert.ok(EXCLUDED_TABLES.has("StaffDocument"));
  assert.ok(EXCLUDED_TABLES.has("CompanyDocument"));
});

test("the prompt card stays small (token budget)", () => {
  const len = schemaCardText().length;
  assert.ok(len < 5000, `schema card is ${len} chars — trim it, it is sent on every question`);
});
