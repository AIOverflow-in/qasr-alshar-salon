// Seed the shop lease as scheduled payments (idempotent — skips rows that already exist by label).
// Run against a DB via: node --env-file=<envfile> scripts/seed-lease.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PAYEE = "Mohammad Zayed Saqer Al-Nahyan"; // landlord (cheques in this name), Bank ADCB
const LEASE = "Dalmok Series · Unit 3 Mezzanine (Office 3) · lease 16 Dec 2025–15 Dec 2026";

// dueDate anchored at 08:00 Dubai so day math is stable.
const at = (ymd) => new Date(`${ymd}T08:00:00+04:00`);

// Post-dated cheques past their due date are assumed cashed (marked PAID) — the owner can flip any
// that didn't clear in the Finance UI. Only genuinely upcoming installments stay PENDING (reminders).
const rows = [
  { label: "Shop rent — 1st installment (cash)", category: "RENT", amountAED: 27500, dueDate: "2025-11-15", method: "CASH", reference: null, status: "PAID", paidAt: "2025-11-15", notes: LEASE },
  { label: "Shop rent — security deposit (refundable)", category: "OTHER", amountAED: 7875, dueDate: "2025-11-15", method: "CASH", reference: null, status: "PAID", paidAt: "2025-11-15", notes: "Refundable security deposit — not a P&L expense" },
  { label: "Shop rent — 2nd installment (cheque #8)", category: "RENT", amountAED: 26000, dueDate: "2026-02-15", method: "CHEQUE", reference: "8", status: "PAID", paidAt: "2026-02-15" },
  { label: "Shop rent — 3rd installment (cheque #9)", category: "RENT", amountAED: 26000, dueDate: "2026-04-15", method: "CHEQUE", reference: "9", status: "PAID", paidAt: "2026-04-15" },
  { label: "Shop rent — 4th installment (cheque #10)", category: "RENT", amountAED: 26000, dueDate: "2026-06-15", method: "CHEQUE", reference: "10", status: "PAID", paidAt: "2026-06-15" },
  { label: "Shop rent — 5th installment (cheque #11)", category: "RENT", amountAED: 26000, dueDate: "2026-08-15", method: "CHEQUE", reference: "11" },
  { label: "Shop rent — 6th installment (cheque #12)", category: "RENT", amountAED: 26000, dueDate: "2026-10-15", method: "CHEQUE", reference: "12" },
];

let created = 0, skipped = 0;
for (const r of rows) {
  const exists = await prisma.scheduledPayment.findFirst({ where: { label: r.label } });
  if (exists) { console.log("skip (exists):", r.label); skipped++; continue; }
  await prisma.scheduledPayment.create({
    data: {
      label: r.label, category: r.category, amountAED: r.amountAED, dueDate: at(r.dueDate),
      payee: PAYEE, method: r.method, reference: r.reference ?? null,
      status: r.status ?? "PENDING", paidAt: r.paidAt ? at(r.paidAt) : null,
      remindDaysBefore: 7, notes: r.notes ?? null,
    },
  });
  console.log("created:", r.label);
  created++;
}
console.log(`\nDone — ${created} created, ${skipped} skipped.`);
await prisma.$disconnect();
