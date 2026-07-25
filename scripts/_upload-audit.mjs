import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const p = new PrismaClient();
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
const BASE = "https://app.qasralsharsalon.com";

// ---- 1) Remove the flagged test expense (General Supplies / SUPPLIES / AED 113) ----
const cands = await p.expense.findMany({
  where: { category: "SUPPLIES", amountAED: 113, description: { contains: "General Supplies", mode: "insensitive" } },
  orderBy: { createdAt: "desc" },
  select: { id: true, description: true, amountAED: true, incurredOn: true, createdAt: true },
});
console.log("=== Test-expense candidates ===");
for (const e of cands) console.log(`  ${e.id} | "${e.description}" AED ${e.amountAED} | created ${e.createdAt.toISOString()}`);
if (cands.length === 1) { await p.expense.delete({ where: { id: cands[0].id } }); console.log("✅ Deleted the 1 matching test expense.\n"); }
else console.log(`⚠️ ${cands.length} matches — not auto-deleting; will confirm which.\n`);

// ---- 2) Live upload probes against the real ERP receipt endpoint ----
const token = await new SignJWT({ email: "audit@qa.test", role: "ADMIN" }).setProtectedHeader({ alg: "HS256" }).setSubject("audit-upload").setIssuedAt().setExpirationTime("10m").sign(secret);
const cookie = `qa_admin=${token}`;
async function probe(label, filename, bytes, type) {
  const fd = new FormData();
  fd.append("file", new File([bytes], filename, { type }));
  let status = 0, body = "";
  try { const r = await fetch(`${BASE}/api/erp/expense-receipt`, { method: "POST", headers: { cookie }, body: fd }); status = r.status; try { body = JSON.stringify(await r.json()); } catch { body = (await r.text().catch(() => "")).slice(0, 80); } }
  catch (e) { body = "fetch error: " + e.message; }
  console.log(`  ${label.padEnd(28)} → HTTP ${status}  ${body.slice(0, 130)}`);
  return { status, body };
}
console.log("=== Upload probes: POST /api/erp/expense-receipt (auth as ADMIN) ===");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
await probe("small PNG (~0.1 KB)", "receipt.png", png, "image/png");
await probe("phone photo ~6 MB JPG", "IMG_6MB.jpg", Buffer.alloc(6 * 1024 * 1024, 1), "image/jpeg");
await probe("iPhone HEIC (small)", "IMG_1234.heic", Buffer.alloc(2048, 1), "image/heic");

await p.$disconnect();
