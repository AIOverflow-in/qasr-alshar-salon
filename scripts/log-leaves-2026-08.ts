/**
 * Log the unpaid leave recorded in the 11 Aug meeting. Idempotent — safe to re-run.
 *
 *   vercel env pull .env.prod --environment=production --yes
 *   node --import tsx --env-file=.env.prod scripts/log-leaves-2026-08.ts          # dry run
 *   node --import tsx --env-file=.env.prod scripts/log-leaves-2026-08.ts --apply
 *   rm .env.prod
 *
 * From the transcript: "10 days for Grace and 20 days for [Amin]ata" — Grace in July, Aminata in
 * August. Only the DAY COUNT drives the deduction (salary / 30 × days), so the exact dates below
 * are representative; correct them in the UI if the real dates differ.
 *
 * NOTE: logging leave does NOT change anyone's pay. It surfaces a suggested deduction that a
 * manager applies with one click, so Grace's already-settled July payment is unaffected.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const LEAVES = [
  { name: "Grace Mwangi", days: 10, start: "2026-07-01", end: "2026-07-10", note: "Unpaid leave (from 11 Aug meeting)" },
  { name: "Aminata Fofana", days: 20, start: "2026-08-01", end: "2026-08-20", note: "Unpaid leave (from 11 Aug meeting)" },
];

async function main() {
  console.log(APPLY ? "APPLYING to production\n" : "DRY RUN — nothing will change (pass --apply to run)\n");

  for (const l of LEAVES) {
    const staff = await prisma.staff.findFirst({ where: { name: l.name }, select: { id: true, name: true, salaryAED: true } });
    if (!staff) { console.log(`  ${l.name} — NOT FOUND, skipping`); continue; }

    // Idempotency: one unpaid-leave row per person per period.
    const existing = await prisma.staffLeave.findFirst({
      where: { staffId: staff.id, type: "UNPAID", startDate: new Date(l.start) },
    });
    const cost = staff.salaryAED > 0 ? Math.round((staff.salaryAED / 30) * Math.min(l.days, 30)) : 0;

    if (existing) {
      console.log(`  ${staff.name} — ${l.days} unpaid days already logged (suggests AED ${cost})`);
      continue;
    }
    if (!APPLY) {
      console.log(`  ${staff.name} — would log ${l.days} unpaid days ${l.start}..${l.end} (suggests AED ${cost})`);
      continue;
    }
    await prisma.staffLeave.create({
      data: { staffId: staff.id, startDate: new Date(l.start), endDate: new Date(l.end), days: l.days, type: "UNPAID", note: l.note },
    });
    console.log(`  ${staff.name} — LOGGED ${l.days} unpaid days (suggests AED ${cost})`);
  }

  console.log(
    APPLY
      ? "\nDone. The deductions are SUGGESTIONS — open Staff → the month → Adjust to apply them."
      : "\nDry run complete — re-run with --apply.",
  );
}

main()
  .catch((e) => { console.error("FAILED:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
