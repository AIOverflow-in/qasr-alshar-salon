// Add a REFERRAL PARTNER: someone who brings clients in but does not work on them.
//
// They need a Staff row because that is what the marketer/referrer picker on a booking and in the
// POS reads from. Deliberately created with salaryAED = 0 and commissionPct = 0, so payroll's
// `max(salesCommission, salary) + referral` formula pays them their referral share and nothing
// else. No ERP login is created — they are not users.
//
//   PARTNER_NAME="Zebra" node --import tsx --env-file=.env.prod scripts/add-referral-partner.ts
//   …same… --apply                                                    # write
import { PrismaClient } from "@prisma/client";
import { normalizeNewStaff } from "../lib/staff-core";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const NAME = (process.env.PARTNER_NAME || "").trim();
const PHONE = (process.env.PARTNER_PHONE || "").trim();
const PCT = Number(process.env.PARTNER_PCT || 5);

async function main() {
  if (!NAME) throw new Error("Set PARTNER_NAME.");

  const existing = await prisma.staff.findFirst({ where: { name: NAME } });
  if (existing) {
    console.log(`"${NAME}" already exists (id ${existing.id}, role ${existing.role}) — nothing to do.`);
    return;
  }

  const clean = normalizeNewStaff({
    name: NAME,
    role: "Referral Partner",
    phone: PHONE || undefined,
    salaryAED: 0,
    commissionPct: 0, // they do not perform services, so no sales split
    referralPct: PCT,
  });

  if (!APPLY) {
    console.log(`WOULD CREATE  ${clean.name} · ${clean.role} · referral ${clean.referralPct}% · salary 0 · commission 0%`);
    console.log("Re-run with --apply to write.");
    return;
  }

  const last = await prisma.staff.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  const created = await prisma.staff.create({
    data: { ...clean, active: true, order: (last?.order ?? 0) + 1 },
  });
  console.log(`CREATED  ${created.name} · ${created.role} · referral ${created.referralPct}% (id ${created.id})`);
}

main()
  .catch((e) => { console.error("FAILED:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
