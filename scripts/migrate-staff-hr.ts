// Additive migration for the Staff HR/compliance fields (idempotent).
// Adds 9 nullable TEXT columns — no existing data is touched, runs instantly.
// Safe to run more than once (ADD COLUMN IF NOT EXISTS).
//
//   vercel env pull .env.prod --environment=production --yes
//   node --import tsx --env-file=.env.prod scripts/migrate-staff-hr.ts
//
// Then populate:
//   node --import tsx --env-file=.env.prod scripts/import-staff-info.ts staff-hr-import.json --apply

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const COLS = [
  "passportNumber", "passportExpiry", "emiratesId", "emiratesIdExpiry",
  "labourPermitNumber", "labourCardNumber", "emergencyContact",
  "emergencyRelationship", "passportPicLink",
];

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Staff" ${COLS.map((c) => `ADD COLUMN IF NOT EXISTS "${c}" TEXT`).join(", ")}`
  );
  const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Staff'`
  );
  const have = new Set(rows.map((r) => r.column_name));
  const missing = COLS.filter((c) => !have.has(c));
  console.log(missing.length ? `STILL MISSING: ${missing.join(", ")}` : `✓ all ${COLS.length} HR columns present on Staff`);
}

main().finally(() => prisma.$disconnect());
