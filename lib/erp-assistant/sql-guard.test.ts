import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSql, MAX_ROWS } from "./sql-guard";

const ok = (sql: string) => {
  const r = validateSql(sql);
  assert.equal(r.ok, true, `expected ACCEPT but got: ${r.ok ? "" : r.reason} — ${sql}`);
  return r.ok ? r.sql : "";
};
const no = (sql: string) => {
  const r = validateSql(sql);
  assert.equal(r.ok, false, `expected REJECT but it was accepted — ${sql}`);
};

test("accepts ordinary read-only queries", () => {
  ok(`SELECT sum("totalAED") FROM "SalesOrder" WHERE "status" = 'PAID'`);
  ok(`SELECT "name", "visits" FROM "Client" ORDER BY "visits" DESC LIMIT 10`);
  ok(`SELECT s."name", sum(c."amountAED") AS total FROM "Commission" c JOIN "Staff" s ON s."id" = c."staffId" GROUP BY s."name"`);
  ok(`WITH paid AS (SELECT "totalAED" FROM "SalesOrder" WHERE "status" = 'PAID') SELECT sum("totalAED") FROM paid`);
  ok(`SELECT count(*) FROM "Booking" WHERE "status" = 'CONFIRMED'`);
});

test("accepts Dubai time-zone bucketing and casts (the most common query shape)", () => {
  ok(`SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Dubai') AS d, sum("totalAED") FROM "SalesOrder" GROUP BY d`);
  ok(`SELECT count(*)::int FROM "Client"`);
  ok(`SELECT extract(month FROM "incurredOn") AS m, sum("amountAED") FROM "Expense" GROUP BY m`);
});

test("accepts quoted output aliases, including when referenced in ORDER BY", () => {
  ok(`SELECT s."name" AS artist, round(sum(c."amountAED")) AS "perClientAED" FROM "Commission" c JOIN "Staff" s ON s."id" = c."staffId" GROUP BY s."name" ORDER BY "perClientAED" DESC`);
  ok(`SELECT sum("totalAED") AS "revenueAED" FROM "SalesOrder"`);
});

test("a denied name cannot be smuggled in as an alias", () => {
  no(`SELECT "name" AS "passwordHash" FROM "Client"`);
  no(`SELECT "name" AS "passportNumber" FROM "Client"`);
});

test("accepts window functions and array membership", () => {
  ok(`SELECT "description", row_number() OVER (PARTITION BY "kind" ORDER BY "lineAED" DESC) FROM "OrderLine"`);
  ok(`SELECT "id" FROM "OrderLine" WHERE 'abc' = ANY("staffIds")`);
});

// ── the false-negative guards: why a tokenizer beats regexes ────────────────
test("keywords INSIDE string literals are harmless", () => {
  ok(`SELECT "name" FROM "Client" WHERE "hairType" = 'drop table now'`);
  ok(`SELECT "description" FROM "Expense" WHERE "description" = 'delete from staff'`);
});

test("OFFSET is not SET, and quoted role/user columns still work", () => {
  ok(`SELECT "id" FROM "Client" LIMIT 10 OFFSET 5`);
  ok(`SELECT "role" FROM "Staff"`); // 'role' banned bare, allowed as a quoted column
});

// ── rejections ──────────────────────────────────────────────────────────────
test("rejects every write / DDL verb", () => {
  for (const s of [
    `INSERT INTO "Client" ("name") VALUES ('x')`,
    `UPDATE "Staff" SET "salaryAED" = 0`,
    `DELETE FROM "Client"`,
    `DROP TABLE "Client"`,
    `ALTER TABLE "Staff" ADD COLUMN x int`,
    `TRUNCATE "SalesOrder"`,
    `CREATE TABLE x (a int)`,
    `GRANT SELECT ON "Staff" TO PUBLIC`,
  ]) no(s);
});

test("rejects stacked statements, comments and dollar quoting", () => {
  no(`SELECT 1 FROM "Client"; DROP TABLE "Client"`);
  no(`SELECT "id" FROM "Client" -- comment`);
  no(`SELECT "id" FROM "Client" /* comment */`);
  no(`SELECT $$x$$ FROM "Client"`);
  no(`SELECT "id" FROM "Client" WHERE "id" = $1`);
  no(`SELECT E'\\x41' FROM "Client"`);
});

test("rejects dangerous functions and system catalogues", () => {
  no(`SELECT pg_sleep(10) FROM "Client"`);
  no(`SELECT pg_read_file('/etc/passwd') FROM "Client"`);
  no(`SELECT current_setting('x') FROM "Client"`);
  no(`SELECT * FROM information_schema.tables`);
  no(`SELECT * FROM pg_catalog.pg_class`);
  no(`SELECT dblink('x','y') FROM "Client"`);
});

test("rejects secrets and non-allowlisted tables/columns", () => {
  no(`SELECT "passwordHash" FROM "AdminUser"`);
  no(`SELECT passwordhash FROM "Client"`);
  no(`SELECT "passportNumber" FROM "Staff"`);
  no(`SELECT "emiratesId" FROM "Staff"`);
  no(`SELECT "biometricPin" FROM "Staff"`);
  no(`SELECT * FROM "StaffDocument"`);
  no(`SELECT * FROM "CompanyDocument"`);
  no(`SELECT * FROM "Secrets"`);
  no(`SELECT "ssn" FROM "Client"`);
});

test("rejects locking clauses and FETCH (which would dodge the row cap)", () => {
  no(`SELECT "id" FROM "Client" FOR UPDATE`);
  no(`SELECT "id" FROM "Client" FETCH FIRST 5 ROWS ONLY`);
});

test("rejects queries that touch no real table", () => {
  no(`SELECT 1`);
  no(`SELECT now()`);
});

// ── row cap ─────────────────────────────────────────────────────────────────
test("always enforces a row cap", () => {
  assert.match(ok(`SELECT "id" FROM "Client"`), new RegExp(`LIMIT ${MAX_ROWS}$`));
  assert.equal(ok(`SELECT "id" FROM "Client" LIMIT 5`), `SELECT "id" FROM "Client" LIMIT 5`); // small limit kept
  assert.match(ok(`SELECT "id" FROM "Client" LIMIT 100000`), /_capped/); // oversized → wrapped
  assert.match(ok(`SELECT "id" FROM "Client" LIMIT 10 OFFSET 5`), /_capped/); // LIMIT+OFFSET → wrapped
});

test("a LIMIT inside a subquery does not satisfy the outer cap", () => {
  const sql = ok(`SELECT "name" FROM "Client" WHERE "id" IN (SELECT "clientId" FROM "SalesOrder" LIMIT 3)`);
  assert.match(sql, new RegExp(`LIMIT ${MAX_ROWS}$`));
});

test("rejects junk input", () => {
  no("");
  no("   ");
  // @ts-expect-error deliberately wrong type
  assert.equal(validateSql(null).ok, false);
  // @ts-expect-error deliberately wrong type
  assert.equal(validateSql({ sql: "SELECT 1" }).ok, false);
  no("SELECT " + "x".repeat(3000));
});
