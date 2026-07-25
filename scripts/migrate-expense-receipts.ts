// Additive migration for multiple receipts per expense (idempotent).
// Adds receiptUrls/receiptPaths TEXT[] columns and backfills the existing single
// receipt into the arrays. Safe to run more than once.
//
//   vercel env pull .env.prod --environment=production --yes
//   node --import tsx --env-file=.env.prod scripts/migrate-expense-receipts.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Expense"
       ADD COLUMN IF NOT EXISTS "receiptUrls" TEXT[] NOT NULL DEFAULT '{}',
       ADD COLUMN IF NOT EXISTS "receiptPaths" TEXT[] NOT NULL DEFAULT '{}'`
  );
  const backfilled = await prisma.$executeRawUnsafe(
    `UPDATE "Expense"
       SET "receiptUrls" = ARRAY["receiptUrl"],
           "receiptPaths" = CASE WHEN "receiptPath" IS NOT NULL THEN ARRAY["receiptPath"] ELSE '{}'::text[] END
     WHERE "receiptUrl" IS NOT NULL AND cardinality("receiptUrls") = 0`
  );
  console.log(`✓ receiptUrls/receiptPaths ensured; backfilled ${backfilled} existing single receipts into arrays`);
}

main().finally(() => prisma.$disconnect());
