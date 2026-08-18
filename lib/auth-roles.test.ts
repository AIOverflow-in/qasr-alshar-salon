import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Roles were hardcoded in THREE places (auth, admin actions, the UI picker). Adding BOOKING to two
 * of them left "Bookings only" rejected with "Invalid role." — the role existed everywhere except
 * the one list that validated the save. These tests pin that they all agree.
 */
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("every role in the Prisma enum is accepted by auth", () => {
  const schema = read("../prisma/schema.prisma");
  const enumBlock = schema.match(/enum Role \{([\s\S]*?)\}/)![1];
  const roles = enumBlock.split("\n").map((l) => l.trim()).filter((l) => /^[A-Z_]+$/.test(l));
  const allRoles = read("./auth.ts").match(/export const ALL_ROLES[^=]*=\s*\[([^\]]*)\]/)![1];
  for (const r of roles) {
    assert.ok(allRoles.includes(`"${r}"`), `Role.${r} is in schema.prisma but missing from ALL_ROLES in lib/auth.ts`);
  }
});

test("admin actions validate against the shared list, not a private copy", () => {
  const admin = read("./actions/admin.ts");
  assert.ok(/const VALID_ROLES[^=]*=\s*ALL_ROLES/.test(admin),
    "lib/actions/admin.ts must reuse ALL_ROLES — a second hardcoded list is what caused 'Invalid role.'");
  assert.ok(!/const VALID_ROLES\s*=\s*\[/.test(admin), "admin.ts must not re-declare the role list inline");
});

test("BOOKING is a real role everywhere it matters", () => {
  assert.ok(read("../prisma/schema.prisma").includes("BOOKING"), "schema");
  assert.ok(read("./auth.ts").includes('"BOOKING"'), "auth ALL_ROLES");
  assert.ok(read("../components/erp/UsersManager.tsx").includes('"BOOKING"'), "the role picker");
});
