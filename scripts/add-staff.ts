// Add a staff member + their ERP login (idempotent, reusable). Generates the password itself
// so it never appears in shell history. STYLIST also gets a linked Staff record (needed for
// their calendar + commission); other roles are login-only.
//
//   STAFF_NAME="Full Name" STAFF_EMAIL="x@y.z" STAFF_ROLE=STYLIST \
//     node --import tsx --env-file=.env.prod scripts/add-staff.ts          # dry run
//   …same… scripts/add-staff.ts --apply                                    # write
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { normalizeNewStaff } from "../lib/staff-core";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const NAME = (process.env.STAFF_NAME || "").trim();
const EMAIL = (process.env.STAFF_EMAIL || "").trim().toLowerCase();
const ROLE = (process.env.STAFF_ROLE || "STYLIST").trim().toUpperCase();
const VALID = ["SUPER_ADMIN", "ADMIN", "RECEPTION", "STYLIST", "INVESTOR"] as const;

// Strong, readable password (no ambiguous chars like O/0/I/l/1).
function genPassword(len = 14): string {
  const cs = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: len }, () => cs[crypto.randomInt(cs.length)]).join("");
}

async function main() {
  if (!NAME || !EMAIL.includes("@") || !(VALID as readonly string[]).includes(ROLE)) {
    throw new Error(`Set STAFF_NAME, a valid STAFF_EMAIL, and STAFF_ROLE ∈ ${VALID.join("/")}`);
  }
  const existingUser = await prisma.adminUser.findUnique({ where: { email: EMAIL } });
  if (existingUser) {
    console.log(`A login for ${EMAIL} already exists (id ${existingUser.id}) — nothing to do.`);
    return;
  }

  // Resolve/create the linked Staff record for a Crown Artist.
  let staffId: string | null = null;
  if (ROLE === "STYLIST") {
    const existing = await prisma.staff.findFirst({ where: { name: NAME } });
    if (existing) {
      staffId = existing.id;
      console.log(`Reusing existing Staff "${NAME}" (id ${existing.id}).`);
    } else if (APPLY) {
      const clean = normalizeNewStaff({ name: NAME });
      const maxOrder = (await prisma.staff.aggregate({ _max: { order: true } }))._max.order ?? 0;
      const staff = await prisma.staff.create({ data: { ...clean, order: maxOrder + 1 } });
      staffId = staff.id;
      console.log(`Created Staff "${NAME}" (id ${staff.id}).`);
    } else {
      console.log(`Would create Staff "${NAME}".`);
    }
  }

  if (!APPLY) {
    console.log(`DRY RUN: would create a ${ROLE} login for ${EMAIL}. Re-run with --apply to write.`);
    return;
  }

  const password = genPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.create({ data: { name: NAME, email: EMAIL, role: ROLE as never, passwordHash, staffId } });

  console.log("\n================= LOGIN CREATED =================");
  console.log("  Name:     " + NAME);
  console.log("  Email:    " + EMAIL);
  console.log("  Password: " + password);
  console.log("  Role:     " + ROLE + (staffId ? ` (linked to staff ${staffId})` : ""));
  console.log("  Login at: https://app.qasralsharsalon.com/admin/login");
  console.log("================================================");
}

main()
  .catch((e) => { console.error(e?.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
