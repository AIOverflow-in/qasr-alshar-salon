// One-off importer: load HR/compliance details (passport, Emirates ID, labour
// card, emergency contact…) into the Staff table from a JSON export of
// STAFF INFO.xlsx. PII lives OUTSIDE the repo — pass the JSON path as an arg.
//
//   node --import tsx scripts/import-staff-info.ts <records.json>           # dry-run
//   node --import tsx scripts/import-staff-info.ts <records.json> --apply   # write
//
// Record keys: name, contact, passportNumber, passportExpiry, emiratesId,
//   emiratesIdExpiry, labourPermitNumber, labourCardNumber, emergencyContact,
//   emergencyRelationship, passportPicLink.
//
// Matching + cleaning live in lib/staff-import-core.ts (unit-tested). Blank/"N/A"
// cells never overwrite existing data; only unambiguous name matches are applied.

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { matchStaff, buildStaffUpdate } from "../lib/staff-import-core";

const prisma = new PrismaClient();
const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: node --import tsx scripts/import-staff-info.ts <records.json> [--apply]"); process.exit(1); }

async function main() {
  const records: Record<string, string>[] = JSON.parse(readFileSync(file, "utf8"));
  const staff = await prisma.staff.findMany({ select: { id: true, name: true } });
  console.log(`${records.length} rows · ${staff.length} live staff · mode=${APPLY ? "APPLY" : "DRY-RUN"}\n`);

  let updated = 0, skipped = 0, noFields = 0;
  for (const rec of records) {
    const m = matchStaff(staff, rec.name);
    if ("skip" in m) { console.log(`  ⊘ ${rec.name.padEnd(28)} skip — ${m.skip}`); skipped++; continue; }
    const name = staff.find((s) => s.id === m.id)!.name;
    const data = buildStaffUpdate(rec);
    if (Object.keys(data).length === 0) { console.log(`  · ${rec.name.padEnd(28)} → ${name} (no fields to set)`); noFields++; continue; }
    console.log(`  ✓ ${rec.name.padEnd(28)} → ${name}  [${Object.keys(data).join(", ")}]`);
    if (APPLY) await prisma.staff.update({ where: { id: m.id }, data });
    updated++;
  }
  console.log(`\n${APPLY ? "Applied" : "Would update"}: ${updated} · skipped: ${skipped} · no-op: ${noFields}`);
}

main().finally(() => prisma.$disconnect());
