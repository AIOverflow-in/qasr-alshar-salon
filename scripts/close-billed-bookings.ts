/**
 * Close bookings that were BILLED but left at CONFIRMED. Idempotent, dry-run by default.
 *
 *   node --import tsx --env-file=.env.prod scripts/close-billed-bookings.ts          # preview
 *   node --import tsx --env-file=.env.prod scripts/close-billed-bookings.ts --apply
 *
 * Cause: attaching a bill to an existing booking went through the POS edit path, which deliberately
 * never changed the booking's status — so the appointment stayed "upcoming" forever. Fixed at source
 * in app/api/erp/pos/route.ts; this clears the ones already in that state.
 *
 * ONLY touches bookings that are still CONFIRMED, are in the PAST, and have a PAID bill — a paid
 * bill is proof the appointment happened. Unbilled past bookings are deliberately left alone:
 * whether they were a no-show or simply never billed is a judgement only the salon can make.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(APPLY ? "APPLYING to production\n" : "DRY RUN — nothing will change (pass --apply)\n");

  const stale = await prisma.booking.findMany({
    where: { status: "CONFIRMED", startAt: { lt: new Date() } },
    select: { id: true, customerName: true, startAt: true, salesOrders: { select: { invoiceNo: true, status: true } } },
    orderBy: { startAt: "asc" },
  });

  const billed = stale.filter((b) => b.salesOrders.some((o) => o.status === "PAID"));
  const unbilled = stale.filter((b) => !b.salesOrders.some((o) => o.status === "PAID"));

  for (const b of billed) {
    const inv = b.salesOrders.find((o) => o.status === "PAID")!.invoiceNo;
    if (!APPLY) { console.log(`  would close: ${b.customerName} · ${inv}`); continue; }
    await prisma.booking.update({ where: { id: b.id }, data: { status: "COMPLETED" } });
    console.log(`  CLOSED: ${b.customerName} · ${inv}`);
  }
  if (!billed.length) console.log("  no billed-but-open bookings — nothing to do");

  if (unbilled.length) {
    console.log(`\n  ${unbilled.length} past booking(s) have NO bill — left untouched, decide these in the ERP:`);
    for (const b of unbilled) {
      console.log(`    ${b.startAt.toISOString().slice(0, 10)}  ${b.customerName}`);
    }
  }
  console.log(APPLY ? "\nDone." : "\nDry run complete.");
}

main().catch((e) => { console.error("FAILED:", e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
