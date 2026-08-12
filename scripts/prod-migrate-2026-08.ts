/**
 * Production migration — August 2026. ADDITIVE ONLY, and safe to re-run.
 *
 *   vercel env pull .env.prod --environment=production --yes
 *   node --import tsx --env-file=.env.prod scripts/prod-migrate-2026-08.ts --apply
 *   rm .env.prod
 *
 * Without --apply it only reports what is missing and changes nothing.
 *
 * 1. ExpenseCategory += FOOD, PARKING, CEO_ALLOWANCE  (PR #103 — food / parking+Salik / CEO
 *    allowance budget lines agreed in the 11 Aug meeting). Saving one of these fails until the
 *    enum value exists in Postgres.
 * 2. "AssistantQuery" table (PR #97) — the Ask-Anything SQL cache. The app degrades gracefully
 *    without it, but every question logs an error and repeat questions re-pay for the model.
 *
 * No column is dropped, no row is written or deleted.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const NEW_CATEGORIES = ["FOOD", "PARKING", "CEO_ALLOWANCE"];
const NEW_ROLES = ["BOOKING"]; // bookings-only staff role

async function main() {
  console.log(APPLY ? "APPLYING to production\n" : "DRY RUN — nothing will change (pass --apply to run)\n");

  // ── 1. enum values ────────────────────────────────────────────────────────
  const existing = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
    `SELECT e.enumlabel FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'ExpenseCategory'`,
  );
  const have = new Set(existing.map((r) => r.enumlabel));
  for (const value of NEW_CATEGORIES) {
    if (have.has(value)) { console.log(`  ExpenseCategory.${value} — already present`); continue; }
    if (!APPLY) { console.log(`  ExpenseCategory.${value} — MISSING (would add)`); continue; }
    // IF NOT EXISTS makes this idempotent; ADD VALUE cannot run inside a transaction block.
    await prisma.$executeRawUnsafe(`ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS '${value}'`);
    console.log(`  ExpenseCategory.${value} — ADDED`);
  }

  // ── 1b. Role enum: BOOKING ────────────────────────────────────────────────
  const roleLabels = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'Role'`,
  );
  const haveRoles = new Set(roleLabels.map((r) => r.enumlabel));
  for (const value of NEW_ROLES) {
    if (haveRoles.has(value)) { console.log(`  Role.${value} — already present`); continue; }
    if (!APPLY) { console.log(`  Role.${value} — MISSING (would add)`); continue; }
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS '${value}'`);
    console.log(`  Role.${value} — ADDED`);
  }

  // ── 2. AssistantQuery table ───────────────────────────────────────────────
  const tbl = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM information_schema.tables WHERE table_schema='public' AND table_name='AssistantQuery'`,
  );
  if (Number(tbl[0]?.n ?? 0) > 0) {
    console.log(`  "AssistantQuery" — already present`);
  } else if (!APPLY) {
    console.log(`  "AssistantQuery" — MISSING (would create)`);
  } else {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AssistantQuery" (
        "id"          TEXT PRIMARY KEY,
        "hash"        TEXT NOT NULL UNIQUE,
        "question"    TEXT NOT NULL,
        "status"      TEXT NOT NULL DEFAULT 'SQL',
        "sql"         TEXT,
        "title"       TEXT,
        "hits"        INTEGER NOT NULL DEFAULT 0,
        "lastAskedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AssistantQuery_lastAskedAt_idx" ON "AssistantQuery"("lastAskedAt")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AssistantQuery_status_hits_idx" ON "AssistantQuery"("status", "hits")`);
    console.log(`  "AssistantQuery" — CREATED`);
  }

  // ── 3. CategoryBudget table (budgeting tool) ──────────────────────────────
  const bt = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM information_schema.tables WHERE table_schema='public' AND table_name='CategoryBudget'`,
  );
  if (Number(bt[0]?.n ?? 0) > 0) {
    console.log(`  "CategoryBudget" — already present`);
  } else if (!APPLY) {
    console.log(`  "CategoryBudget" — MISSING (would create)`);
  } else {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CategoryBudget" (
        "id"        TEXT PRIMARY KEY,
        "category"  "ExpenseCategory" NOT NULL UNIQUE,
        "amountAED" INTEGER NOT NULL,
        "note"      TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    console.log(`  "CategoryBudget" — CREATED`);
  }

  // ── 4. StaffLoan table (loans repaid over months) ─────────────────────────
  const lt = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM information_schema.tables WHERE table_schema='public' AND table_name='StaffLoan'`,
  );
  if (Number(lt[0]?.n ?? 0) > 0) {
    console.log(`  "StaffLoan" — already present`);
  } else if (!APPLY) {
    console.log(`  "StaffLoan" — MISSING (would create)`);
  } else {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StaffLoan" (
        "id"        TEXT PRIMARY KEY,
        "staffId"   TEXT NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
        "amountAED" INTEGER NOT NULL,
        "repaidAED" INTEGER NOT NULL DEFAULT 0,
        "note"      TEXT,
        "issuedOn"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "closedAt"  TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StaffLoan_staffId_idx" ON "StaffLoan"("staffId")`);
    console.log(`  "StaffLoan" — CREATED`);
  }

  console.log(APPLY ? "\nDone." : "\nDry run complete — re-run with --apply to make these changes.");
}

main()
  .catch((e) => { console.error("FAILED:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
