// Offboard staff who have left: deactivate the Staff record and disable their ERP login.
//
// DEACTIVATE, never delete. Their past bills, commissions and payroll history must stay intact —
// deleting the row would orphan or destroy that history and corrupt every past report. Deactivating
// removes them from the artist picker, payroll and the team dashboard while keeping the record.
//
//   OFFBOARD="Name One|Name Two" node --import tsx --env-file=.env.prod scripts/offboard-staff.ts
//   …same… --apply
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const NAMES = (process.env.OFFBOARD || "").split("|").map((n) => n.trim()).filter(Boolean);

async function main() {
  if (!NAMES.length) throw new Error('Set OFFBOARD="Name One|Name Two"');

  for (const name of NAMES) {
    const staff = await prisma.staff.findFirst({ where: { name: { contains: name, mode: "insensitive" } } });
    if (!staff) { console.log(`  ${name} — NO staff record found, skipped`); continue; }

    const login = await prisma.adminUser.findFirst({ where: { staffId: staff.id } });
    const upcoming = await prisma.booking.count({
      where: { staffId: staff.id, startAt: { gt: new Date() }, status: { in: ["CONFIRMED"] } },
    });

    const todo: string[] = [];
    if (staff.active) todo.push("deactivate staff");
    if (login?.active) todo.push("disable login");
    if (!todo.length) { console.log(`  ${staff.name} — already fully offboarded`); continue; }

    if (!APPLY) {
      console.log(`  ${staff.name} — WOULD ${todo.join(" + ")}${upcoming ? `  ⚠️ ${upcoming} upcoming booking(s)` : ""}`);
      continue;
    }

    if (staff.active) await prisma.staff.update({ where: { id: staff.id }, data: { active: false } });
    if (login?.active) await prisma.adminUser.update({ where: { id: login.id }, data: { active: false } });
    console.log(`  ${staff.name} — ${todo.join(" + ")} DONE${upcoming ? `  ⚠️ ${upcoming} upcoming booking(s) need reassigning` : ""}`);
  }
}

main()
  .catch((e) => { console.error("FAILED:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
