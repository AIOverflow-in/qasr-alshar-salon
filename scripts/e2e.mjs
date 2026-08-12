/**
 * Qasr Alshar ERP — regression + E2E runner.
 * Run green BEFORE every push so shipped features don't regress.
 *
 *   node --env-file=.env scripts/e2e.mjs
 *
 * Needs the dev server running (E2E_BASE, default http://localhost:3000) and the
 * DB reachable. Read-only except two self-cleaning checks (oversell, payroll math).
 */
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { vatFromInclusive, netFromInclusive } from "../lib/vat-core.ts";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const prisma = new PrismaClient();
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "✅" : "❌"} ${m}`); c ? pass++ : fail++; };
const section = (t) => console.log(`\n── ${t} ──`);

const tok = (role) => new SignJWT({ email: `e2e-${role}@qa.test`, role })
  .setProtectedHeader({ alg: "HS256" }).setSubject(`e2e-${role}`).setIssuedAt().setExpirationTime("1h").sign(secret);

async function code(path, role) {
  const t = role ? await tok(role) : null;
  const r = await fetch(BASE + path, { headers: t ? { cookie: `qa_admin=${t}` } : {}, redirect: "manual" });
  return (r.type === "opaqueredirect" || r.status === 0 || r.status === 307 || r.status === 308) ? "REDIR" : String(r.status);
}
async function body(path, role) {
  const t = await tok(role);
  const r = await fetch(BASE + path, { headers: { cookie: `qa_admin=${t}` } });
  return { status: r.status, text: await r.text() };
}
// Mint a token for a SPECIFIC user id (for real linked adminUser accounts, e.g. a marketer).
const mintTok = (sub, role) => new SignJWT({ email: `e2e-${sub}@qa.test`, role })
  .setProtectedHeader({ alg: "HS256" }).setSubject(sub).setIssuedAt().setExpirationTime("1h").sign(secret);
async function codeTok(path, t) {
  const r = await fetch(BASE + path, { headers: { cookie: `qa_admin=${t}` }, redirect: "manual" });
  return (r.type === "opaqueredirect" || r.status === 0 || r.status === 307 || r.status === 308) ? "REDIR" : String(r.status);
}

function dubaiMonth() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit" }).format(new Date()); }
function dayRange(off = 0) {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = iso.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d + off) - 4 * 3600e3);
  return { start, end: new Date(start.getTime() + 864e5) };
}

// ── test-data markers ──────────────────────────────────────────────────────
// Everything the suite creates is tagged with one of these so the final sweep can
// remove it — making the suite SAFE TO RUN ON PRODUCTION (it leaves the DB as it found it).
const TAG = "__E2E_";            // names / line descriptions
const REQ = "e2e-";              // clientRequestId prefix (idempotency keys)
const adminToken = () => tok("SUPER_ADMIN"); // (role-only) token for read checks

// Poll a value until it equals `expected` (or times out) — avoids read-after-write races.
async function poll(fn, expected, tries = 25, ms = 100) {
  for (let i = 0; i < tries; i++) { const v = await fn(); if (v === expected || i === tries - 1) return v; await new Promise((r) => setTimeout(r, ms)); }
}

// Remove every row this suite could have created. Idempotent; safe to run repeatedly / on prod.
async function cleanupSweep() {
  const testOrders = await prisma.salesOrder.findMany({
    where: { OR: [
      { lines: { some: { description: { startsWith: TAG } } } },
      { lines: { some: { description: { startsWith: "__DBG_" } } } },
      { clientRequestId: { startsWith: REQ } },
    ] },
    select: { id: true },
  });
  const oIds = testOrders.map((o) => o.id);
  if (oIds.length) {
    await prisma.commission.deleteMany({ where: { orderId: { in: oIds } } });
    await prisma.salesOrder.deleteMany({ where: { id: { in: oIds } } }); // OrderLine cascades
  }
  const bk = await prisma.booking.deleteMany({ where: { customerName: { startsWith: TAG } } }); // BookingItem cascades
  const cl = await prisma.client.deleteMany({ where: { name: { startsWith: TAG } } });
  const sv = await prisma.service.deleteMany({ where: { name: { startsWith: TAG } } });
  const usr = await prisma.adminUser.deleteMany({ where: { email: { startsWith: TAG } } });
  const stf = await prisma.staff.deleteMany({ where: { name: { startsWith: TAG } } }); // cascades docs/leaves/adjustments
  const sp = await prisma.scheduledPayment.deleteMany({ where: { label: { startsWith: TAG } } });
  const ex = await prisma.expense.deleteMany({ where: { description: { startsWith: TAG } } });
  const so = await prisma.shopOrder.deleteMany({ where: { customerName: { startsWith: TAG } } });
  await prisma.blogPost.deleteMany({ where: { slug: { startsWith: "e2e-" } } });
  await prisma.keyword.deleteMany({ where: { phrase: { startsWith: "__e2e" } } });
  await prisma.attendancePunch.deleteMany({ where: { OR: [{ pin: { startsWith: REQ } }, { deviceSn: { startsWith: "E2E" } }] } });
  const tagProducts = await prisma.product.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } });
  let prodCount = 0;
  if (tagProducts.length) {
    const pids = tagProducts.map((p) => p.id);
    await prisma.stockMovement.deleteMany({ where: { productId: { in: pids } } });
    prodCount = (await prisma.product.deleteMany({ where: { id: { in: pids } } })).count;
  }
  return { orders: oIds.length, bookings: bk.count, clients: cl.count, services: sv.count, staff: stf.count, users: usr.count, scheduled: sp.count, expenses: ex.count, products: prodCount, shopOrders: so.count };
}

try {
  section("Public + ERP pages load");
  ok((await code("/")) === "200", "home 200");
  ok((await code("/book")) === "200", "/book 200");
  ok((await code("/terms")) === "200", "/terms 200");
  ok((await code("/admin/login")) === "200", "/admin/login 200");
  ok((await code("/erp", "RECEPTION")) === "REDIR", "ERP dashboard: reception redirected (dashboard is owner-only now)");

  section("Public website: every public page loads (regression)");
  for (const p of ["/", "/services", "/gallery", "/shop", "/blog", "/about", "/contact", "/packages", "/henna", "/terms", "/sitemap.xml", "/robots.txt"])
    ok((await code(p)) === "200", `${p} 200`);

  section("Public website: every service category page loads");
  for (const slug of ["cornrow-styles", "braiding-styles", "locks", "hair-styling", "haircut", "hairstyling-caucasian", "hair-coloring", "hair-treatment", "weaving", "qasr-glam", "hands", "podology", "facials", "face-waxing", "body-waxing", "lashes", "henna", "massage"])
    ok((await code(`/services/${slug}`)) === "200", `/services/${slug} 200`);

  section("Public website: shop detail + sellability DB-mapping (self-cleaning)");
  {
    // A sellable product must appear on the storefront; a hidden one must NOT — this
    // guards the retail/active/price/qty/image mapping that decides what customers see.
    const A = `e2e-shop-live-${Date.now()}`, B = `e2e-shop-hidden-${Date.now()}`;
    const common = { category: "Hair Extensions", description: "E2E regression product.", imageUrl: "/products/bundle-straight.jpg", saleAED: 500, qty: 5, active: true };
    await prisma.product.create({ data: { ...common, name: `${TAG}Live Product`, slug: A, retail: true } });
    await prisma.product.create({ data: { ...common, name: `${TAG}Hidden Product`, slug: B, retail: false } });
    ok((await code("/shop")) === "200", "shop page 200");
    ok((await code(`/shop/${A}`)) === "200", "sellable product -> detail 200");
    ok((await code(`/shop/${B}`)) !== "200", "hidden product (retail:false) -> NOT exposed on storefront (mapping intact)");
    const pd = await (await fetch(BASE + `/shop/${A}`)).text();
    ok(pd.includes("Live Product") && /add to cart/i.test(pd), "product detail renders name + Add to Cart");
    // Guard SEO metadata: a throwing generateMetadata (e.g. an og:type Next rejects) silently wipes
    // ALL head metadata with a 200, so assert a real, product-named <title> is actually emitted.
    const pdTitle = (pd.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "";
    ok(/Live Product/.test(pdTitle) && /Qasr Alshar/.test(pdTitle), "product detail emits a real <title> (generateMetadata didn't throw)");
    ok((await code("/products/bundle-straight.jpg")) === "200", "product image file resolves (public/products served)");
  }

  section("Public website: shop-order API guards (no write, no email)");
  {
    const postShop = async (payload) => (await fetch(BASE + "/api/shop/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })).status;
    ok((await postShop({})) >= 400, "shop order: empty payload rejected");
    ok((await postShop({ items: [], customerName: "Q", phone: "1", address: "x" })) >= 400, "shop order: invalid payload rejected");
  }

  section("Public website: blog post + service gallery render");
  {
    const post = await prisma.blogPost.findFirst({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, select: { slug: true } });
    ok(post ? (await code(`/blog/${post.slug}`)) === "200" : true, post ? "a published blog post renders 200" : "blog: no published posts (skipped)");
    const svc = await (await fetch(BASE + "/services/facials")).text();
    ok(/Book Now/i.test(svc), "service page has a Book Now button");
    ok(/\/services\/svc-|\/work\//.test(svc), "service page renders work images");
  }

  section("RBAC matrix");
  ok((await code("/erp/sales", "RECEPTION")) === "200", "sales: reception 200");
  ok((await code("/erp/sales", "STYLIST")) === "REDIR", "sales: stylist blocked");
  ok((await code("/api/erp/sales/export?range=today", "RECEPTION")) === "200", "export: reception 200");
  ok((await code("/api/erp/sales/export?range=today", "STYLIST")) === "403", "export: stylist 403");
  ok((await code("/api/erp/sales/export?range=today", null)) === "401", "export: unauth 401");
  ok((await code("/erp/staff", "ADMIN")) === "200", "staff/payroll: admin 200");
  ok((await code("/erp/staff", "RECEPTION")) === "REDIR", "staff/payroll: reception blocked");
  ok((await code("/erp/finance", "INVESTOR")) === "200", "finance: investor 200");
  ok((await code("/erp/finance", "RECEPTION")) === "REDIR", "finance: reception blocked");
  ok((await code("/erp/users", "SUPER_ADMIN")) === "200", "users: super-admin 200");
  ok((await code("/erp/users", "ADMIN")) === "REDIR", "users: admin blocked");

  section("Crown-artist logins must be linked to a staff record (calendar RCA guardrail)");
  {
    // An unlinked STYLIST login surfaces the warning on the Users page (so it never silently breaks).
    const u = await prisma.adminUser.create({ data: { email: `${TAG}stylist@qa.test`, name: `${TAG}Unlinked Artist`, role: "STYLIST", passwordHash: "x", staffId: null } });
    const pg = await body("/erp/users", "SUPER_ADMIN");
    ok(pg.text.includes("not linked to a staff record"), "users: unlinked crown-artist warning shown");
    // Linking it clears the warning for that user (calendar would now populate).
    const st = await prisma.staff.findFirst({ where: { active: true }, select: { id: true } });
    if (st) {
      await prisma.adminUser.update({ where: { id: u.id }, data: { staffId: st.id } });
      const still = await prisma.adminUser.count({ where: { role: "STYLIST", staffId: null, email: { startsWith: TAG } } });
      ok(still === 0, "users: linking a crown artist removes it from the unlinked set");
    }
    await prisma.adminUser.delete({ where: { id: u.id } });
  }

  section("Legacy /admin panel: role-gated (no customer-PII leak by typed URL)");
  {
    // bookings holds customer PII — front-desk+ only; crown artists/investors blocked.
    ok((await code("/admin/bookings", "STYLIST")) === "REDIR", "/admin/bookings: stylist blocked (PII)");
    ok((await code("/admin/bookings", "INVESTOR")) === "REDIR", "/admin/bookings: investor blocked (PII)");
    ok((await code("/admin/bookings", null)) === "REDIR", "/admin/bookings: unauth blocked");
    ok((await code("/admin/bookings", "RECEPTION")) === "200", "/admin/bookings: reception 200");
    ok((await code("/admin/bookings", "ADMIN")) === "200", "/admin/bookings: admin 200");
    // services/blog/hours are manager-only (mirror /erp) — reception blocked, admin ok.
    ok((await code("/admin/services", "RECEPTION")) === "REDIR", "/admin/services: reception blocked");
    ok((await code("/admin/blog", "RECEPTION")) === "REDIR", "/admin/blog: reception blocked");
    ok((await code("/admin/hours", "RECEPTION")) === "REDIR", "/admin/hours: reception blocked");
    ok((await code("/admin/services", "ADMIN")) === "200", "/admin/services: admin 200");
  }

  section("Add staff: onboarding affordance + new staff flows into payroll");
  {
    // Managers see the "Add staff" button on the staff page (createStaff is manager-only).
    const adm = await body("/erp/staff", "ADMIN");
    ok(adm.text.includes("Add staff"), "staff page: 'Add staff' button rendered for managers");
    // A newly-onboarded staff (what createStaff persists) appears in the pay-config table
    // and is immediately part of monthly payroll — defaults: Crown Artist / 40% / 5% / salary 0.
    const maxOrder = (await prisma.staff.aggregate({ _max: { order: true } }))._max.order ?? 0;
    const hire = await prisma.staff.create({
      data: { name: `${TAG}NEWHIRE`, role: "Crown Artist", commissionPct: 40, referralPct: 5, salaryAED: 0, order: maxOrder + 1 },
    });
    const staffPage = await body("/erp/staff", "ADMIN");
    ok(staffPage.text.includes(`${TAG}NEWHIRE`), "staff page: newly added staff appears in the pay-config table");
    await prisma.staff.delete({ where: { id: hire.id } });
  }

  section("Expenses: reception add-only screen + receipt upload RBAC + payslip report");
  {
    // Add-only expenses screen is reachable by reception + admins, blocked for stylists.
    ok((await code("/erp/expenses", "RECEPTION")) === "200", "expenses page: reception 200");
    ok((await code("/erp/expenses", "ADMIN")) === "200", "expenses page: admin 200");
    ok((await code("/erp/expenses", "STYLIST")) === "REDIR", "expenses page: stylist blocked");
    ok((await code("/erp/finance", "RECEPTION")) === "REDIR", "finance (capital/P&L) still blocked for reception");
    // Receipt upload route: reception passes auth (400 w/o file), stylist 403, anon 401.
    const upload = async (role) => {
      const t = role ? await tok(role) : null;
      const r = await fetch(BASE + "/api/erp/expense-receipt", { method: "POST", headers: t ? { cookie: `qa_admin=${t}` } : {} });
      return r.status;
    };
    ok((await upload("STYLIST")) === 403, "receipt upload: stylist 403");
    ok([400, 500].includes(await upload("RECEPTION")), "receipt upload: reception passes auth (validation without a file)");
    ok((await upload(null)) === 401, "receipt upload: anon 401");
    // Direct-to-Blob upload authorizer (any file up to 20 MB) — must fail SAFE (4xx, never 500/200) on garbage.
    const blobUp = async (role, bodyObj) => {
      const t = role ? await tok(role) : null;
      const r = await fetch(BASE + "/api/erp/blob-upload", { method: "POST", headers: { "content-type": "application/json", ...(t ? { cookie: `qa_admin=${t}` } : {}) }, body: JSON.stringify(bodyObj) });
      return r.status;
    };
    ok([400, 401].includes(await blobUp(null, {})), "blob-upload: unauth garbage → 4xx (no crash)");
    ok([400, 401].includes(await blobUp("STYLIST", { type: "blob.generate-client-token" })), "blob-upload: bad/forbidden request → 4xx");
    ok([400, 401].includes(await blobUp("RECEPTION", {})), "blob-upload: reception garbage → 4xx (fails safe)");
    // Per-staff monthly report PDF (payslip) — admin only, renders as a PDF with the perf section.
    const st = await prisma.staff.findFirst({ where: { active: true }, select: { id: true } });
    if (!st) { ok(false, "need an active staff for the payslip test"); }
    else {
      const t = await tok("ADMIN");
      const r = await fetch(`${BASE}/api/erp/payroll/payslip/${st.id}?month=${dubaiMonth()}`, { headers: { cookie: `qa_admin=${t}` } });
      ok(r.status === 200 && (r.headers.get("content-type") || "").includes("pdf"), `payslip PDF: admin 200 + application/pdf (${r.status})`);
      ok((await code(`/api/erp/payroll/payslip/${st.id}`, "STYLIST")) === "403", "payslip PDF: stylist 403");
      ok((await code(`/api/erp/payroll/payslip/${st.id}`, "RECEPTION")) === "403", "payslip PDF: reception 403");
    }
    // Reception's add-only list must show ONLY their own entries — never a SALARIES row
    // or another user's expense (privacy of payroll/other figures).
    {
      const own = await prisma.expense.create({ data: { description: `${TAG}RECOWN`, category: "SUPPLIES", amountAED: 11, createdById: "e2e-RECEPTION" } });
      const sal = await prisma.expense.create({ data: { description: `${TAG}SALARY`, category: "SALARIES", amountAED: 99999, createdById: "e2e-ADMIN" } });
      const other = await prisma.expense.create({ data: { description: `${TAG}OTHEROWN`, category: "SUPPLIES", amountAED: 22, createdById: "e2e-ADMIN" } });
      const rec = await body("/erp/expenses", "RECEPTION");
      ok(rec.text.includes(`${TAG}RECOWN`), "reception expenses: sees their own entry");
      ok(!rec.text.includes(`${TAG}SALARY`), "reception expenses: does NOT see a SALARIES row");
      ok(!rec.text.includes(`${TAG}OTHEROWN`), "reception expenses: does NOT see another user's entry");
      const adm = await body("/erp/expenses", "ADMIN");
      ok(adm.text.includes(`${TAG}SALARY`) && adm.text.includes(`${TAG}OTHEROWN`), "admin expenses: sees all entries");
      await prisma.expense.deleteMany({ where: { id: { in: [own.id, sal.id, other.id] } } });
    }
    // Expense dashboard: month total card, category breakdown chips, receipt preview,
    // month/category filters, and CSV export (which must honor the reception privacy scope).
    {
      const rc = await prisma.expense.create({ data: { description: `${TAG}RCPT`, category: "SUPPLIES", amountAED: 42, createdById: "e2e-ADMIN", receiptUrl: "https://x.public.blob.vercel-storage.com/expense-receipts/test-abc.png" } });
      const pg = await body("/erp/expenses", "ADMIN");
      ok(pg.text.includes("/api/erp/expenses/export"), "expenses: CSV export link shown");
      ok(pg.text.includes("All ·"), "expenses: category breakdown chips shown");
      ok(pg.text.includes(`${TAG}RCPT`) && pg.text.includes("receipt"), "expenses: receipt preview trigger renders");
      // Expenses tab is limited to Maintenance/Supplies/Other; Finance keeps the full set.
      ok(pg.text.includes('value="MAINTENANCE"') && !pg.text.includes('value="RENT"'), "expenses tab: category picker limited (Maintenance/Supplies/Other, no Rent)");
      const fin = await body("/erp/finance", "ADMIN");
      ok(fin.text.includes('value="RENT"') && fin.text.includes('value="UTILITIES"'), "finance tab: full category set (Rent, Utilities, …)");
      ok(fin.text.includes("Email daily digest"), "finance: on-demand digest button shown to owner");
      ok((await code("/erp/expenses?month=2020-01", "ADMIN")) === "200", "expenses: past-month view renders");
      ok((await code("/erp/expenses?category=SUPPLIES&q=abc", "RECEPTION")) === "200", "expenses: category+search filter renders");
      await prisma.expense.deleteMany({ where: { id: rc.id } });

      // CSV export RBAC + reception privacy (own rows only, never SALARIES).
      ok((await code("/api/erp/expenses/export", "STYLIST")) === "403", "expenses CSV: stylist 403");
      const cOwn = await prisma.expense.create({ data: { description: `${TAG}CSVOWN`, category: "SUPPLIES", amountAED: 33, createdById: "e2e-RECEPTION" } });
      const cSal = await prisma.expense.create({ data: { description: `${TAG}CSVSAL`, category: "SALARIES", amountAED: 88888, createdById: "e2e-ADMIN" } });
      const recCsv = await body("/api/erp/expenses/export", "RECEPTION");
      ok(recCsv.text.includes(`${TAG}CSVOWN`), "reception CSV: includes own expense");
      ok(!recCsv.text.includes(`${TAG}CSVSAL`) && !recCsv.text.includes("88888"), "reception CSV: excludes SALARIES/others");
      const admCsv = await body("/api/erp/expenses/export", "ADMIN");
      ok(admCsv.status === 200 && admCsv.text.includes("Amount (AED)"), "admin CSV: 200 with header row");
      await prisma.expense.deleteMany({ where: { id: { in: [cOwn.id, cSal.id] } } });
    }
  }

  section("Server-side pagination + search");
  {
    // Over-range ?page clamps to a valid page (never a blank screen / error).
    ok((await code("/erp/products?page=99999", "ADMIN")) === "200", "products: over-range ?page clamps to 200");
    ok((await code("/erp/bookings?when=all&page=99999", "ADMIN")) === "200", "bookings: over-range ?page clamps to 200");
    // A paginated page renders a DIFFERENT slice on page 2 (proves server skip/take) — when there's enough data.
    const clientCount = await prisma.client.count();
    if (clientCount > 20) {
      const c1 = await body("/erp/clients", "ADMIN");
      const c2 = await body("/erp/clients?page=2", "ADMIN");
      ok(c1.status === 200 && c2.status === 200 && c1.text !== c2.text, `clients: page 2 is a different slice than page 1 (${clientCount} clients)`);
    } else {
      ok(true, `clients page-2 slice test skipped (only ${clientCount} clients on clone)`);
    }
    // Server-side booking search: a uniquely-named booking is found by ?q= and excluded by a non-matching query.
    const bkg = await prisma.booking.create({ data: { serviceName: `${TAG}PGSRCH_SVC`, priceAED: 100, durationMin: 60, customerName: `${TAG}PGSRCH`, email: "pg@e2e.test", phone: "", startAt: new Date(), endAt: new Date(Date.now() + 3600e3), status: "CONFIRMED" } });
    const hit = await body(`/erp/bookings?when=all&q=${TAG}PGSRCH`, "ADMIN");
    ok(hit.text.includes(`${TAG}PGSRCH`), "bookings ?q= finds the matching booking (server-side search)");
    const miss = await body(`/erp/bookings?when=all&q=${TAG}NOMATCHZZZ`, "ADMIN");
    ok(!miss.text.includes(`${TAG}PGSRCH`), "bookings ?q= excludes non-matches (server-side, not just the loaded page)");
    await prisma.booking.deleteMany({ where: { id: bkg.id } });
  }

  section("Bookings filters load + count consistency");
  for (const w of ["today", "tomorrow", "next2w", "all"]) ok((await code(`/erp/bookings?when=${w}`, "RECEPTION")) === "200", `bookings when=${w}`);
  {
    const total = await prisma.booking.count();
    const sg = await prisma.booking.groupBy({ by: ["status"], _count: true });
    ok(sg.reduce((a, g) => a + g._count, 0) === total, `Σ status counts == total (${total})`);
  }

  section("Sales totals: CSV == DB (3 months)");
  {
    const start = dayRange(-89).start, end = dayRange(0).end;
    const agg = await prisma.salesOrder.aggregate({ _sum: { totalAED: true }, _count: true, where: { status: "PAID", createdAt: { gte: start, lt: end } } });
    const { text } = await body("/api/erp/sales/export?range=3m", "ADMIN");
    const lines = text.trim().split("\n");
    const csvCount = lines.length - 2; // minus header + TOTAL
    const csvTotal = Number(lines[lines.length - 1].split(",").pop());
    ok(csvCount === agg._count, `CSV rows ${csvCount} == DB ${agg._count}`);
    ok(csvTotal === (agg._sum.totalAED ?? 0), `CSV total ${csvTotal} == DB ${agg._sum.totalAED ?? 0}`);
  }

  section("Attribution columns exist (no regression on auth/POS/bookings)");
  try { await prisma.adminUser.findFirst({ select: { active: true } }); ok(true, "AdminUser.active queryable"); } catch (e) { ok(false, "AdminUser.active: " + e.message.split("\n")[0]); }
  try { await prisma.salesOrder.findFirst({ select: { createdById: true } }); ok(true, "SalesOrder.createdById queryable"); } catch (e) { ok(false, "SalesOrder.createdById: " + e.message.split("\n")[0]); }
  try { await prisma.booking.findFirst({ select: { createdById: true } }); ok(true, "Booking.createdById queryable"); } catch (e) { ok(false, "Booking.createdById: " + e.message.split("\n")[0]); }
  try { await prisma.staff.findFirst({ select: { phone: true } }); ok(true, "Staff.phone queryable"); } catch (e) { ok(false, "Staff.phone: " + e.message.split("\n")[0]); }

  section("Calendar ICS feed");
  {
    const crypto = await import("node:crypto");
    const token = crypto.createHash("sha256").update(`${process.env.AUTH_SECRET}:bookings-calendar`).digest("hex").slice(0, 32);
    const good = await fetch(`${BASE}/api/calendar?token=${token}`);
    const txt = await good.text();
    ok(good.status === 200 && txt.startsWith("BEGIN:VCALENDAR"), "valid token → VCALENDAR");
    const bad = await fetch(`${BASE}/api/calendar?token=wrong`);
    ok(bad.status === 403, "bad token → 403");
  }

  section("POS oversell guard (atomic decrement, self-cleaning)");
  {
    const prod = await prisma.product.create({ data: { name: "__E2E_TEST__", category: "TEST", qty: 10, active: false } });
    const results = await Promise.all(Array.from({ length: 25 }, () =>
      prisma.product.updateMany({ where: { id: prod.id, qty: { gte: 1 } }, data: { qty: { decrement: 1 } } }).then((r) => r.count).catch(() => -1)));
    const okCount = results.filter((c) => c === 1).length;
    const after = await prisma.product.findUnique({ where: { id: prod.id }, select: { qty: true } });
    ok(okCount === 10 && after.qty === 0, `25 concurrent → 10 ok, final qty ${after.qty} (no oversell)`);
    await prisma.product.delete({ where: { id: prod.id } });
  }

  section("Payroll net-pay math (self-cleaning)");
  {
    const s = await prisma.staff.findFirst({ orderBy: { order: "asc" }, select: { id: true, name: true, salaryAED: true } });
    const month = dubaiMonth();
    await prisma.staff.update({ where: { id: s.id }, data: { salaryAED: 5000 } });
    const b = await prisma.payAdjustment.create({ data: { staffId: s.id, month, type: "BONUS", amountAED: 500 } });
    const a = await prisma.payAdjustment.create({ data: { staffId: s.id, month, type: "ADVANCE", amountAED: 200 } });
    const { start, end } = { start: new Date(Date.UTC(...month.split("-").map(Number).map((v, i) => i ? v - 1 : v), 1) - 4 * 3600e3), end: dayRange(0).end };
    // New pay model: net = max(sales commission, base salary) + referral + bonus − deductions.
    const commByType = await prisma.commission.groupBy({ by: ["type"], _sum: { amountAED: true }, where: { staffId: s.id, createdAt: { gte: start, lt: end } } });
    const salesComm = commByType.filter((g) => g.type !== "REFERRAL").reduce((x, g) => x + (g._sum.amountAED ?? 0), 0);
    const referral = commByType.filter((g) => g.type === "REFERRAL").reduce((x, g) => x + (g._sum.amountAED ?? 0), 0);
    const { text } = await body(`/api/erp/payroll/export?month=${month}`, "ADMIN");
    const row = text.split("\n").find((l) => l.startsWith(s.name) || l.includes(`"${s.name}"`));
    const net = row ? Number(row.split(",").slice(-2, -1)[0]) : NaN;
    const expected = Math.max(salesComm, 5000) + referral + 500 - 200;
    ok(net === expected, `net ${net} == max(${salesComm} comm, 5000 base) + ${referral} ref + 500 − 200 = ${expected}`);
    await prisma.payAdjustment.deleteMany({ where: { id: { in: [b.id, a.id] } } });
    await prisma.staff.update({ where: { id: s.id }, data: { salaryAED: s.salaryAED } });
  }

  section("In-store multi-service booking (self-cleaning)");
  {
    const u = await prisma.adminUser.findFirst({ where: { active: true }, select: { id: true } });
    const svcs = await prisma.service.findMany({ where: { active: true }, take: 2, select: { id: true, priceAED: true, durationMin: true } });
    const mkt = await prisma.staff.findFirst({ where: { active: true }, select: { id: true } });
    if (!u || svcs.length < 2) {
      ok(false, "need an active user + 2 active services to test multi-service booking");
    } else {
      const t = await new SignJWT({ email: "e2e-erp@qa.test", role: "RECEPTION" })
        .setProtectedHeader({ alg: "HS256" }).setSubject(u.id).setIssuedAt().setExpirationTime("1h").sign(secret);
      const startISO = new Date(dayRange(1).start.getTime() + 12 * 3600e3).toISOString();
      const agreed = 111; // line 1 overrides the menu price; line 2 keeps it
      const res = await fetch(BASE + "/api/erp/bookings", {
        method: "POST", headers: { "Content-Type": "application/json", cookie: `qa_admin=${t}` },
        body: JSON.stringify({ services: [{ serviceId: svcs[0].id, priceAED: agreed }, { serviceId: svcs[1].id }], startISO, customerName: "__E2E_MULTI__", phone: "", email: "", serviceMode: "SALON", enforceAvailability: false, marketerId: mkt?.id ?? null }),
      });
      const data = await res.json().catch(() => ({}));
      const created = res.ok && data?.booking?.id
        ? await prisma.booking.findUnique({ where: { id: data.booking.id }, include: { items: { select: { priceAED: true, durationMin: true } } } })
        : null;
      const expTotal = agreed + svcs[1].priceAED, expDur = svcs[0].durationMin + svcs[1].durationMin;
      ok(!!created && created.items.length === 2 && created.priceAED === expTotal && created.durationMin === expDur && created.createdById === u.id,
        `2 services → 2 items, total ${created?.priceAED} == ${expTotal}, dur ${created?.durationMin} == ${expDur}, attributed to creator`);
      ok(!!created && created.marketerId === (mkt?.id ?? null), "booking stores marketer (lead source) for the bill's referral");
      if (created) await prisma.booking.delete({ where: { id: created.id } });
      await prisma.client.deleteMany({ where: { name: "__E2E_MULTI__" } });
    }
  }

  section("Edit booking: services + per-line price + reschedule late, no closing block (self-cleaning)");
  {
    const u = await prisma.adminUser.findFirst({ where: { active: true }, select: { id: true } });
    const svcs = await prisma.service.findMany({ where: { active: true }, take: 3, select: { id: true } });
    if (!u || svcs.length < 3) {
      ok(false, "need an active user + 3 active services to test booking edit");
    } else {
      const t = await new SignJWT({ email: "e2e-erp@qa.test", role: "RECEPTION" })
        .setProtectedHeader({ alg: "HS256" }).setSubject(u.id).setIssuedAt().setExpirationTime("1h").sign(secret);
      const hdr = { "Content-Type": "application/json", cookie: `qa_admin=${t}` };
      const cr = await fetch(BASE + "/api/erp/bookings", { method: "POST", headers: hdr, body: JSON.stringify({ services: [{ serviceId: svcs[0].id }], startISO: new Date(dayRange(1).start.getTime() + 11 * 3600e3).toISOString(), customerName: "__E2E_EDIT__", phone: "", email: "", serviceMode: "SALON", enforceAvailability: false }) });
      const bid = (await cr.json().catch(() => ({})))?.booking?.id;
      // Reschedule to 11pm (past closing) + swap to 2 services with custom prices → must succeed (closing check removed).
      const lateISO = new Date(dayRange(2).start.getTime() + 23 * 3600e3).toISOString();
      const ed = bid ? await fetch(`${BASE}/api/erp/bookings/${bid}`, { method: "PATCH", headers: hdr, body: JSON.stringify({ services: [{ serviceId: svcs[1].id, priceAED: 77 }, { serviceId: svcs[2].id, priceAED: 33 }], startISO: lateISO }) }) : null;
      const after = ed && ed.ok ? await prisma.booking.findUnique({ where: { id: bid }, include: { items: { select: { priceAED: true } } } }) : null;
      ok(ed?.status === 200 && after && after.items.length === 2 && after.priceAED === 110 && Math.abs(after.startAt.getTime() - new Date(lateISO).getTime()) < 1000,
        `edit → 2 items, price ${after?.priceAED} == 110, rescheduled to 11pm, no closing block (PATCH ${ed?.status})`);
      if (bid) await prisma.booking.delete({ where: { id: bid } });
      await prisma.client.deleteMany({ where: { name: "__E2E_EDIT__" } });
    }
  }

  section("Bill edit (PATCH /api/erp/pos): reception + admin allowed, stylist blocked");
  {
    const patch = async (role) => {
      const t = role ? await tok(role) : null;
      const r = await fetch(BASE + "/api/erp/pos", { method: "PATCH", headers: { "Content-Type": "application/json", ...(t ? { cookie: `qa_admin=${t}` } : {}) }, body: JSON.stringify({}) });
      return r.status;
    };
    const rec = await patch("RECEPTION"); ok(rec !== 403 && rec !== 401, `edit bill: reception allowed (past gate, got ${rec})`);
    const adm = await patch("ADMIN"); ok(adm !== 403 && adm !== 401, `edit bill: admin allowed (past gate, got ${adm})`);
    ok((await patch("STYLIST")) === 403, "edit bill: stylist blocked 403");
    ok((await patch(null)) === 401, "edit bill: unauth 401");
  }

  section("Multi-artist bill: attribution, shares, fallback + per-artist page RBAC (self-cleaning)");
  {
    const u = await prisma.adminUser.findFirst({ where: { active: true }, select: { id: true } });
    const staff2 = await prisma.staff.findMany({ take: 2, orderBy: { order: "asc" }, select: { id: true, name: true, commissionPct: true } });
    if (!u || staff2.length < 2) {
      ok(false, "need an active user + 2 staff for the multi-artist test");
    } else {
      const [A, B] = staff2;
      const t = await new SignJWT({ email: "e2e-erp@qa.test", role: "ADMIN" })
        .setProtectedHeader({ alg: "HS256" }).setSubject(u.id).setIssuedAt().setExpirationTime("1h").sign(secret);
      const hdr = { "Content-Type": "application/json", cookie: `qa_admin=${t}` };
      const res = await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({
        paymentMethod: "CASH", staffId: A.id, clientRequestId: `e2e-ma-${Date.now()}`,
        lines: [
          { kind: "SERVICE", description: "__E2E_MA_1", qty: 1, unitAED: 100, staffIds: [A.id] },        // A only
          { kind: "SERVICE", description: "__E2E_MA_2", qty: 1, unitAED: 60, staffIds: [A.id, B.id] },    // A + B (split)
          { kind: "SERVICE", description: "__E2E_MA_3", qty: 1, unitAED: 40 },                            // none → falls back to order staffId A
        ],
      }) });
      const orderId = (await res.json().catch(() => ({})))?.order?.id;
      const artistsOf = (l, os) => (l.staffIds?.length ? l.staffIds : (l.staffId ? [l.staffId] : (os ? [os] : [])));
      const order = orderId ? await prisma.salesOrder.findUnique({ where: { id: orderId }, include: { lines: true } }) : null;
      if (!order) {
        ok(false, "multi-artist sale create failed");
      } else {
        const distinct = new Set(order.lines.flatMap((l) => artistsOf(l, order.staffId)));
        ok(distinct.size === 2 && distinct.has(A.id) && distinct.has(B.id), `bill surfaces both artists (got ${distinct.size})`);
        const shareFor = (id) => order.lines.reduce((s, l) => { const a = artistsOf(l, order.staffId); return a.includes(id) ? s + Math.round(l.lineAED / a.length) : s; }, 0);
        const countFor = (id) => order.lines.filter((l) => artistsOf(l, order.staffId).includes(id)).length;
        ok(countFor(A.id) === 3 && shareFor(A.id) === 170, `A: 3 services, share ${shareFor(A.id)} == 170 (incl. fallback line)`);
        ok(countFor(B.id) === 1 && shareFor(B.id) === 30, `B: 1 service, share ${shareFor(B.id)} == 30`);
        const commA = (await prisma.commission.aggregate({ _sum: { amountAED: true }, where: { orderId, staffId: A.id } }))._sum.amountAED ?? 0;
        const commB = (await prisma.commission.aggregate({ _sum: { amountAED: true }, where: { orderId, staffId: B.id } }))._sum.amountAED ?? 0;
        // Prices are VAT-inclusive → commission base is the per-line NET (ex-VAT) share.
        const baseFor = (id) => order.lines.reduce((s, l) => { if (l.kind !== "SERVICE") return s; const a = artistsOf(l, order.staffId); return a.includes(id) ? s + netFromInclusive(l.lineAED) / a.length : s; }, 0);
        ok(commA === Math.round(baseFor(A.id) * A.commissionPct / 100), `A commission ${commA} == round(net ${baseFor(A.id)}×${A.commissionPct}%)`);
        ok(commB === Math.round(baseFor(B.id) * B.commissionPct / 100), `B commission ${commB} == round(net ${baseFor(B.id)}×${B.commissionPct}%)`);
        await prisma.commission.deleteMany({ where: { orderId } });
        await prisma.salesOrder.delete({ where: { id: orderId } });
      }
      ok((await code(`/erp/staff/${A.id}`, "ADMIN")) === "200", "artist page: admin can view 200");
      ok((await code(`/erp/staff/${A.id}`, "RECEPTION")) === "REDIR", "artist page: reception (not own) blocked");
      ok((await code(`/erp/staff/${A.id}`, null)) === "REDIR", "artist page: unauth blocked");
    }
  }

  section("Split payment: store, validate, breakdown columns (self-cleaning)");
  {
    const u = await prisma.adminUser.findFirst({ where: { active: true }, select: { id: true } });
    const svc = await prisma.service.findFirst({ where: { active: true }, select: { id: true } });
    if (!u || !svc) {
      ok(false, "need an active user + a service for the split-payment test");
    } else {
      const t = await new SignJWT({ email: "e2e-erp@qa.test", role: "ADMIN" })
        .setProtectedHeader({ alg: "HS256" }).setSubject(u.id).setIssuedAt().setExpirationTime("1h").sign(secret);
      const hdr = { "Content-Type": "application/json", cookie: `qa_admin=${t}` };
      const lines = [{ kind: "SERVICE", description: "__E2E_SPLIT_1", qty: 1, unitAED: 100 }, { kind: "SERVICE", description: "__E2E_SPLIT_2", qty: 1, unitAED: 100 }]; // VAT-inclusive → total 200
      // Split that doesn't add up to the total is rejected.
      const bad = await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ splitPayment: true, cashAED: 100, cardAED: 50, transferAED: 0, clientRequestId: `e2e-spbad-${Date.now()}`, lines }) });
      ok(bad.status === 400, `split not summing to total rejected (${bad.status})`);
      // Valid split: cash 120 + card 80 = 200 (the inclusive total).
      const res = await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ splitPayment: true, cashAED: 120, cardAED: 80, transferAED: 0, clientRequestId: `e2e-sp-${Date.now()}`, lines }) });
      const orderId = (await res.json().catch(() => ({})))?.order?.id;
      const o = orderId ? await prisma.salesOrder.findUnique({ where: { id: orderId }, select: { splitPayment: true, cashAED: true, cardAED: true, transferAED: true, paymentMethod: true, totalAED: true } }) : null;
      ok(!!o && o.splitPayment && o.cashAED === 120 && o.cardAED === 80 && o.transferAED === 0 && o.totalAED === 200, `split stored: cash 120 + card 80 = total ${o?.totalAED}`);
      ok(!!o && o.paymentMethod === "CASH", `dominant method = CASH (${o?.paymentMethod})`);
      // Breakdown building blocks: the split aggregate reads the columns; the single-method bucket excludes it (no double count).
      const splitAgg = await prisma.salesOrder.aggregate({ where: { id: orderId, splitPayment: true }, _sum: { cashAED: true, cardAED: true } });
      ok(splitAgg._sum.cashAED === 120 && splitAgg._sum.cardAED === 80, "breakdown reads split columns");
      ok((await prisma.salesOrder.count({ where: { id: orderId, splitPayment: false } })) === 0, "split bill excluded from single-method bucket");
      if (orderId) { await prisma.commission.deleteMany({ where: { orderId } }); await prisma.salesOrder.delete({ where: { id: orderId } }); }
    }
  }

  section("VAT-inclusive pricing: total = entered price; VAT + net computed out of it");
  {
    const u = await prisma.adminUser.findFirst({ where: { active: true }, select: { id: true } });
    if (!u) { ok(false, "need an active user for the VAT test"); }
    else {
      const hdr = { "Content-Type": "application/json", cookie: `qa_admin=${await mintTok(u.id, "ADMIN")}` };
      const res = await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ clientRequestId: `${REQ}vat-${Date.now()}`, lines: [{ kind: "SERVICE", description: "__E2E_VAT", qty: 1, unitAED: 315 }] }) });
      const oid = (await res.json().catch(() => ({})))?.order?.id;
      const o = oid ? await prisma.salesOrder.findUnique({ where: { id: oid }, select: { subtotalAED: true, vatAED: true, totalAED: true } }) : null;
      ok(!!o && o.totalAED === 315 && o.vatAED === vatFromInclusive(315) && o.subtotalAED === 315 - vatFromInclusive(315),
        `inclusive: total ${o?.totalAED}==315, VAT ${o?.vatAED}==${vatFromInclusive(315)}, net ${o?.subtotalAED}==${315 - vatFromInclusive(315)}`);
      if (oid) { await prisma.commission.deleteMany({ where: { orderId: oid } }); await prisma.salesOrder.delete({ where: { id: oid } }); }
    }
  }

  section("Commission: services only + per-artist override (self-cleaning)");
  {
    const u = await prisma.adminUser.findFirst({ where: { active: true }, select: { id: true } });
    const A = await prisma.staff.findFirst({ where: { active: true }, select: { id: true, commissionPct: true } });
    if (!u || !A) {
      ok(false, "need an active user + staff for the commission test");
    } else {
      const t = await new SignJWT({ email: "e2e-erp@qa.test", role: "ADMIN" })
        .setProtectedHeader({ alg: "HS256" }).setSubject(u.id).setIssuedAt().setExpirationTime("1h").sign(secret);
      const hdr = { "Content-Type": "application/json", cookie: `qa_admin=${t}` };
      // Service 200 (by A) + product 100 (by A) → commission only on the 200; product excluded.
      const r1 = await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ clientRequestId: `e2e-cs-${Date.now()}`, staffId: A.id, lines: [{ kind: "SERVICE", description: "__E2E_CS_SVC", qty: 1, unitAED: 200, staffIds: [A.id] }, { kind: "PRODUCT", description: "__E2E_CS_PROD", qty: 1, unitAED: 100, staffIds: [A.id] }] }) });
      const o1 = (await r1.json().catch(() => ({})))?.order?.id;
      const c1 = o1 ? ((await prisma.commission.aggregate({ _sum: { amountAED: true }, where: { orderId: o1, staffId: A.id, type: "SALES_SPLIT" } }))._sum.amountAED ?? 0) : -1;
      ok(c1 === Math.round(netFromInclusive(200) * A.commissionPct / 100), `commission on service NET only: ${c1} == round(net ${netFromInclusive(200)}×${A.commissionPct}%), product excluded`);
      if (o1) { await prisma.commission.deleteMany({ where: { orderId: o1 } }); await prisma.salesOrder.delete({ where: { id: o1 } }); }
      // Per-artist override: service 200 by A, agreed commission = 55 (not the auto).
      const r2 = await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ clientRequestId: `e2e-co-${Date.now()}`, staffId: A.id, commissions: [{ staffId: A.id, amountAED: 55 }], lines: [{ kind: "SERVICE", description: "__E2E_CO_SVC", qty: 1, unitAED: 200, staffIds: [A.id] }] }) });
      const o2 = (await r2.json().catch(() => ({})))?.order?.id;
      const c2 = o2 ? ((await prisma.commission.aggregate({ _sum: { amountAED: true }, where: { orderId: o2, staffId: A.id, type: "SALES_SPLIT" } }))._sum.amountAED ?? 0) : -1;
      ok(c2 === 55, `per-artist commission override applied: ${c2} == 55`);
      if (o2) { await prisma.commission.deleteMany({ where: { orderId: o2 } }); await prisma.salesOrder.delete({ where: { id: o2 } }); }
    }
  }

  section("Marketer commission override + walk-in client resolution (self-cleaning)");
  {
    const u = await prisma.adminUser.findFirst({ where: { active: true }, select: { id: true } });
    const [A, M] = await prisma.staff.findMany({ where: { active: true }, take: 2, select: { id: true } });
    if (!u || !A || !M) {
      ok(false, "need an active user + 2 staff for the marketer/walk-in test");
    } else {
      const t = await new SignJWT({ email: "e2e-erp@qa.test", role: "ADMIN" })
        .setProtectedHeader({ alg: "HS256" }).setSubject(u.id).setIssuedAt().setExpirationTime("1h").sign(secret);
      const hdr = { "Content-Type": "application/json", cookie: `qa_admin=${t}` };
      // Marketer commission override + walk-in name → should resolve a client (not "Walk-in").
      const res = await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({
        clientRequestId: `e2e-mkt-${Date.now()}`, staffId: A.id, marketerId: M.id, marketerAmountAED: 33,
        customerName: "__E2E_WALKIN_NAME__",
        lines: [{ kind: "SERVICE", description: "__E2E_MKT_SVC", qty: 1, unitAED: 200, staffIds: [A.id] }],
      }) });
      const oid = (await res.json().catch(() => ({})))?.order?.id;
      const order = oid ? await prisma.salesOrder.findUnique({ where: { id: oid }, include: { client: { select: { name: true } } } }) : null;
      const ref = oid ? ((await prisma.commission.aggregate({ _sum: { amountAED: true }, where: { orderId: oid, staffId: M.id, type: "REFERRAL" } }))._sum.amountAED ?? 0) : -1;
      ok(ref === 33, `marketer commission override applied: ${ref} == 33 (not the 5% default)`);
      ok(!!order?.clientId && order.client?.name === "__E2E_WALKIN_NAME__", `walk-in name resolved to a client (${order?.client?.name}), not "Walk-in"`);
      if (oid) { await prisma.commission.deleteMany({ where: { orderId: oid } }); await prisma.salesOrder.delete({ where: { id: oid } }); }
      await prisma.client.deleteMany({ where: { name: "__E2E_WALKIN_NAME__" } });
    }
  }

  section("Edit bill: recomputes commission services-only, no stale (self-cleaning)");
  {
    const u = await prisma.adminUser.findFirst({ where: { active: true }, select: { id: true } });
    const A = await prisma.staff.findFirst({ where: { active: true }, select: { id: true, commissionPct: true } });
    if (!u || !A) { ok(false, "need user + staff for edit-commission test"); }
    else {
      const t = await new SignJWT({ email: "e2e-erp@qa.test", role: "ADMIN" }).setProtectedHeader({ alg: "HS256" }).setSubject(u.id).setIssuedAt().setExpirationTime("1h").sign(secret);
      const hdr = { "Content-Type": "application/json", cookie: `qa_admin=${t}` };
      const lines = [{ kind: "SERVICE", description: "__E2E_EDIT_SVC", qty: 1, unitAED: 100, staffIds: [A.id] }, { kind: "PRODUCT", description: "__E2E_EDIT_PROD", qty: 1, unitAED: 50 }];
      const want = Math.round(netFromInclusive(100) * A.commissionPct / 100); // services-only, VAT-inclusive: net(100) × pct, product excluded
      const r1 = await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ clientRequestId: `e2e-ed-${Date.now()}`, staffId: A.id, lines }) });
      const oid = (await r1.json().catch(() => ({})))?.order?.id;
      // Poll the just-committed value to avoid a read racing the write on the pooled connection.
      const commSum = async (expected) => {
        for (let i = 0; i < 20; i++) {
          const v = (await prisma.commission.aggregate({ _sum: { amountAED: true }, where: { orderId: oid, staffId: A.id, type: "SALES_SPLIT" } }))._sum.amountAED ?? -1;
          if (v === expected || i === 19) return v;
          await new Promise((r) => setTimeout(r, 100));
        }
      };
      ok(oid && (await commSum(want)) === want, `create: commission == ${want} (services-only)`);
      // Edit with NO override → must recompute to services-only (not stale, not incl. product).
      const r2 = oid ? await fetch(BASE + "/api/erp/pos", { method: "PATCH", headers: hdr, body: JSON.stringify({ orderId: oid, staffId: A.id, lines }) }) : null;
      ok(r2 && r2.ok && (await commSum(want)) === want, `edit (no override): recomputes to ${want}, not stale (PATCH ${r2?.status})`);
      // Edit WITH override → stored exactly.
      const r3 = oid ? await fetch(BASE + "/api/erp/pos", { method: "PATCH", headers: hdr, body: JSON.stringify({ orderId: oid, staffId: A.id, lines, commissions: [{ staffId: A.id, amountAED: 25 }] }) }) : null;
      ok(r3 && r3.ok && (await commSum(25)) === 25, `edit (override 25): stored == 25 (PATCH ${r3?.status})`);
      if (oid) { await prisma.commission.deleteMany({ where: { orderId: oid } }); await prisma.salesOrder.delete({ where: { id: oid } }); }
    }
  }

  section("Bill-from-booking: syncs booking items (extensions) + auto-completes (self-cleaning)");
  {
    const u = await prisma.adminUser.findFirst({ where: { active: true }, select: { id: true } });
    const svcs = await prisma.service.findMany({ where: { active: true }, take: 2, select: { id: true, name: true, priceAED: true } });
    const A = await prisma.staff.findFirst({ where: { active: true }, select: { id: true } });
    if (!u || svcs.length < 2 || !A) { ok(false, "need user + 2 services + staff for booking-sync test"); }
    else {
      const t = await new SignJWT({ email: "e2e-erp@qa.test", role: "ADMIN" }).setProtectedHeader({ alg: "HS256" }).setSubject(u.id).setIssuedAt().setExpirationTime("1h").sign(secret);
      const hdr = { "Content-Type": "application/json", cookie: `qa_admin=${t}` };
      // Booking with ONE service.
      const bkRes = await fetch(BASE + "/api/erp/bookings", { method: "POST", headers: hdr, body: JSON.stringify({ services: [{ serviceId: svcs[0].id }], startISO: new Date(dayRange(1).start.getTime() + 12 * 3600e3).toISOString(), staffId: A.id, customerName: "__E2E_SYNC__", phone: "", email: "", serviceMode: "SALON", enforceAvailability: false }) });
      const bid = (await bkRes.json().catch(() => ({})))?.booking?.id;
      // Bill it with the original service + an ADDED service (extension).
      const billRes = bid ? await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ bookingId: bid, staffId: A.id, clientRequestId: `e2e-sync-${Date.now()}`, lines: [{ kind: "SERVICE", description: svcs[0].name, qty: 1, unitAED: svcs[0].priceAED, staffIds: [A.id] }, { kind: "SERVICE", description: svcs[1].name, qty: 1, unitAED: svcs[1].priceAED, staffIds: [A.id] }] }) }) : null;
      const oid = billRes && billRes.ok ? (await billRes.json())?.order?.id : null;
      const bk = bid ? await prisma.booking.findUnique({ where: { id: bid }, select: { status: true, priceAED: true, items: { select: { id: true } } } }) : null;
      ok(!!bk && bk.items.length === 2, `booking now mirrors billed services (extensions): ${bk?.items.length} == 2`);
      ok(!!bk && bk.priceAED === svcs[0].priceAED + svcs[1].priceAED, `booking price synced to bill: ${bk?.priceAED} == ${svcs[0].priceAED + svcs[1].priceAED}`);
      ok(!!bk && bk.status === "COMPLETED", `booking auto-completed on billing: ${bk?.status}`);
      if (oid) { await prisma.commission.deleteMany({ where: { orderId: oid } }); await prisma.salesOrder.delete({ where: { id: oid } }); }
      if (bid) await prisma.booking.delete({ where: { id: bid } });
      await prisma.client.deleteMany({ where: { name: "__E2E_SYNC__" } });
    }
  }

  section("Past-time in-store booking is allowed (self-cleaning)");
  {
    const u = await prisma.adminUser.findFirst({ where: { active: true }, select: { id: true } });
    const svc = await prisma.service.findFirst({ where: { active: true }, select: { id: true } });
    if (!u || !svc) { ok(false, "need user + service for past-booking test"); }
    else {
      const t = await new SignJWT({ email: "e2e-erp@qa.test", role: "RECEPTION" }).setProtectedHeader({ alg: "HS256" }).setSubject(u.id).setIssuedAt().setExpirationTime("1h").sign(secret);
      // Yesterday at noon, WITH enforceAvailability true (not skipping) → must still be allowed.
      const pastISO = new Date(dayRange(-1).start.getTime() + 12 * 3600e3).toISOString();
      const res = await fetch(BASE + "/api/erp/bookings", { method: "POST", headers: { "Content-Type": "application/json", cookie: `qa_admin=${t}` }, body: JSON.stringify({ services: [{ serviceId: svc.id }], startISO: pastISO, customerName: "__E2E_PAST__", phone: "", email: "", serviceMode: "SALON", enforceAvailability: true }) });
      const bid = res.ok ? (await res.json())?.booking?.id : null;
      ok(res.status === 200 && !!bid, `past-time in-store booking accepted (status ${res.status})`);
      if (bid) await prisma.booking.delete({ where: { id: bid } });
      await prisma.client.deleteMany({ where: { name: "__E2E_PAST__" } });
    }
  }

  section("Calendar page RBAC");
  ok((await code("/erp/calendar", "ADMIN")) === "200", "calendar: admin 200");
  ok((await code("/erp/calendar", "RECEPTION")) === "200", "calendar: reception 200");
  ok((await code("/erp/calendar", "STYLIST")) === "200", "calendar: stylist (crown artist) 200");
  ok((await code("/erp/calendar", null)) === "REDIR", "calendar: unauth blocked");
  ok((await code("/erp/calendar?week=2026-07-06", "ADMIN")) === "200", "calendar: week nav param 200");

  section("Crown artist: read-only, no booking access");
  ok((await code("/erp/bookings", "STYLIST")) === "REDIR", "bookings table: stylist blocked (→ calendar)");
  ok((await code("/erp", "STYLIST")) === "REDIR", "dashboard: stylist redirected (→ calendar)");
  {
    const st = await tok("STYLIST");
    const be = await fetch(`${BASE}/api/erp/bookings/nonexistent-id`, { method: "PATCH", headers: { "Content-Type": "application/json", cookie: `qa_admin=${st}` }, body: JSON.stringify({ services: [{ serviceId: "x" }] }) });
    ok(be.status === 403, `booking edit API: stylist 403 (${be.status})`);
  }

  // ═══════════ Extended edge cases (all data tagged → removed by the finally sweep) ═══════════
  const eu = await prisma.adminUser.findFirst({ where: { active: true }, select: { id: true } });
  const esvc = await prisma.service.findFirst({ where: { active: true }, select: { id: true, name: true, priceAED: true } });
  const estaff = await prisma.staff.findFirst({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true } });
  const eh = async (role = "ADMIN") => ({ "Content-Type": "application/json", cookie: `qa_admin=${await new SignJWT({ email: "e2e@qa.test", role }).setProtectedHeader({ alg: "HS256" }).setSubject(eu.id).setIssuedAt().setExpirationTime("1h").sign(secret)}` });

  if (!eu || !esvc || !estaff) {
    ok(false, "extended edge cases need an active user + service + staff");
  } else {
    section("Idempotent checkout: duplicate request key → one bill");
    {
      const hdr = await eh();
      const rid = `${REQ}idem-${Date.now()}`;
      const b = JSON.stringify({ clientRequestId: rid, lines: [{ kind: "SERVICE", description: `${TAG}IDEM`, qty: 1, unitAED: 100 }] });
      const i1 = (await (await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: b })).json().catch(() => ({})))?.order?.id;
      const i2 = (await (await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: b })).json().catch(() => ({})))?.order?.id;
      const cnt = await poll(() => prisma.salesOrder.count({ where: { clientRequestId: rid } }), 1);
      ok(!!i1 && i1 === i2 && cnt === 1, `duplicate submit → exactly one bill (same id: ${i1 === i2}, count ${cnt})`);
    }

    section("Edit bill reverses & re-applies client spend");
    {
      const hdr = await eh();
      const cr = await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ clientRequestId: `${REQ}rev-${Date.now()}`, customerName: `${TAG}Rev`, customerPhone: "0500000091", lines: [{ kind: "SERVICE", description: `${TAG}REV`, qty: 1, unitAED: 100 }] }) });
      const oid = (await cr.json().catch(() => ({})))?.order?.id;
      const cid = oid ? (await prisma.salesOrder.findUnique({ where: { id: oid }, select: { clientId: true } }))?.clientId : null;
      if (oid && cid) await fetch(BASE + "/api/erp/pos", { method: "PATCH", headers: hdr, body: JSON.stringify({ orderId: oid, clientId: cid, lines: [{ kind: "SERVICE", description: `${TAG}REV`, qty: 1, unitAED: 200 }] }) });
      const spend = cid ? await poll(async () => (await prisma.client.findUnique({ where: { id: cid }, select: { totalSpentAED: true } }))?.totalSpentAED, 200) : -1;
      const visits = cid ? (await prisma.client.findUnique({ where: { id: cid }, select: { visits: true } }))?.visits : -1;
      ok(spend === 200 && visits === 1, `client after edit: spend ${spend}==200 (VAT-inclusive), ${visits}==1 visit (old reversed, new applied)`);
    }

    section("Client dedup by phone");
    {
      const hdr = await eh("RECEPTION");
      const phone = "0509998887";
      const mk = (nm) => fetch(BASE + "/api/erp/bookings", { method: "POST", headers: hdr, body: JSON.stringify({ services: [{ serviceId: esvc.id }], startISO: new Date(dayRange(1).start.getTime() + 11 * 3600e3).toISOString(), customerName: nm, phone, email: "", serviceMode: "SALON", enforceAvailability: false }) });
      const b1 = (await (await mk(`${TAG}Dedup`)).json().catch(() => ({})))?.booking?.id;
      const b2 = (await (await mk(`${TAG}Dedup2`)).json().catch(() => ({})))?.booking?.id;
      const c1 = b1 ? (await prisma.booking.findUnique({ where: { id: b1 }, select: { clientId: true } }))?.clientId : null;
      const c2 = b2 ? (await prisma.booking.findUnique({ where: { id: b2 }, select: { clientId: true } }))?.clientId : null;
      ok(!!c1 && c1 === c2, "two bookings, same phone → one shared client (dedup)");
    }

    section("Invoice PDF renders");
    {
      const hdr = await eh();
      const invNo = (await (await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ clientRequestId: `${REQ}inv-${Date.now()}`, customerName: `${TAG}Inv`, lines: [{ kind: "SERVICE", description: `${TAG}INV`, qty: 1, unitAED: 150 }] }) })).json().catch(() => ({})))?.order?.invoiceNo;
      const pdf = invNo ? await fetch(`${BASE}/api/erp/invoice/${invNo}`, { headers: hdr }) : null;
      ok(!!pdf && pdf.status === 200 && (pdf.headers.get("content-type") || "").includes("application/pdf"), `invoice ${invNo} → PDF (${pdf?.status}, ${pdf?.headers.get("content-type")})`);

      // Thermal client receipt (printable page) — POS roles render it; others are gated; unknown → 404.
      if (invNo) {
        ok((await code(`/receipt/${invNo}`, "RECEPTION")) === "200", "receipt: reception renders (200)");
        ok((await code(`/receipt/${invNo}`, "SUPER_ADMIN")) === "200", "receipt: super-admin renders (200)");
        ok((await code(`/receipt/${invNo}`, "STYLIST")) === "REDIR", "receipt: stylist redirected (not a POS role)");
        ok((await code(`/receipt/${invNo}`)) === "REDIR", "receipt: anon redirected to login");
        const rb = await body(`/receipt/${invNo}`, "RECEPTION");
        ok(rb.text.includes("Qasr Alshar Salon") && rb.text.includes("Sale Receipt"), "receipt: Sale Receipt renders with brand header");
        ok(rb.text.includes("Payment Detail") && rb.text.includes("Net Amount"), "receipt: has payment-detail + net-amount sections");
        ok(!rb.text.includes("Tax Invoice"), "receipt: 'Sale Receipt' (not a Tax Invoice) before VAT registration");
        ok(!rb.text.includes("TRN") || rb.text.includes("VAT TRN"), "receipt: no bare/pending TRN before VAT registration");
      }
      ok((await code(`/receipt/${TAG}NOPE-000`, "RECEPTION")) === "404", "receipt: unknown invoice → 404");
    }

    section("Booking edit sets the marketer");
    {
      const hdr = await eh("RECEPTION");
      const bid = (await (await fetch(BASE + "/api/erp/bookings", { method: "POST", headers: hdr, body: JSON.stringify({ services: [{ serviceId: esvc.id }], startISO: new Date(dayRange(1).start.getTime() + 13 * 3600e3).toISOString(), customerName: `${TAG}Mkt`, phone: "", email: "", serviceMode: "SALON", enforceAvailability: false }) })).json().catch(() => ({})))?.booking?.id;
      if (bid) await fetch(`${BASE}/api/erp/bookings/${bid}`, { method: "PATCH", headers: hdr, body: JSON.stringify({ services: [{ serviceId: esvc.id }], marketerId: estaff.id }) });
      const mkId = bid ? await poll(async () => (await prisma.booking.findUnique({ where: { id: bid }, select: { marketerId: true } }))?.marketerId, estaff.id) : null;
      ok(mkId === estaff.id, "booking edit persists the marketer");
    }

    section("Validation guards");
    {
      const hdr = await eh();
      ok((await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ clientRequestId: `${REQ}empty-${Date.now()}`, lines: [] }) })).status === 400, "POS empty cart → 400");
      ok((await fetch(BASE + "/api/erp/bookings", { method: "POST", headers: await eh("RECEPTION"), body: JSON.stringify({ services: [], startISO: new Date().toISOString(), customerName: `${TAG}NoSvc`, phone: "", email: "", serviceMode: "SALON" }) })).status === 400, "booking with no service → 400");
      const cb = await prisma.booking.create({ data: { serviceId: esvc.id, serviceName: esvc.name, priceAED: esvc.priceAED, durationMin: 60, customerName: `${TAG}Cancelled`, email: "", phone: "", startAt: new Date(dayRange(1).start.getTime() + 10 * 3600e3), endAt: new Date(dayRange(1).start.getTime() + 11 * 3600e3), status: "CANCELLED", source: "WALKIN" } });
      ok((await fetch(`${BASE}/api/erp/bookings/${cb.id}`, { method: "PATCH", headers: await eh("RECEPTION"), body: JSON.stringify({ services: [{ serviceId: esvc.id }] }) })).status === 409, "edit a cancelled booking → 409");
      const bb = await prisma.booking.create({ data: { serviceId: esvc.id, serviceName: esvc.name, priceAED: esvc.priceAED, durationMin: 60, customerName: `${TAG}Billed`, email: "", phone: "", startAt: new Date(dayRange(1).start.getTime() + 9 * 3600e3), endAt: new Date(dayRange(1).start.getTime() + 10 * 3600e3), status: "CONFIRMED", source: "WALKIN" } });
      await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ bookingId: bb.id, clientRequestId: `${REQ}billed-${Date.now()}`, lines: [{ kind: "SERVICE", description: `${TAG}BILLED`, qty: 1, unitAED: esvc.priceAED }] }) });
      ok((await fetch(`${BASE}/api/erp/bookings/${bb.id}`, { method: "PATCH", headers: await eh("RECEPTION"), body: JSON.stringify({ services: [{ serviceId: esvc.id }] }) })).status === 409, "edit a billed booking → 409");
    }

    section("Editable sale date: back-date + align commission + reject future");
    {
      const hdr = await eh();
      const target = dayRange(-3);
      const soldISO = new Date(target.start.getTime() + 12 * 3600e3).toISOString();
      const inRange = (d, r) => !!d && d >= r.start && d < r.end;
      const oid = (await (await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ clientRequestId: `${REQ}date-${Date.now()}`, staffId: estaff.id, saleDateISO: soldISO, lines: [{ kind: "SERVICE", description: `${TAG}DATE`, qty: 1, unitAED: 100 }] }) })).json().catch(() => ({})))?.order?.id;
      const o = oid ? await prisma.salesOrder.findUnique({ where: { id: oid }, select: { createdAt: true, paidAt: true } }) : null;
      ok(inRange(o?.createdAt, target) && inRange(o?.paidAt, target), "new bill back-dated 3 days (createdAt & paidAt land in target day)");
      const comm = oid ? await prisma.commission.findFirst({ where: { orderId: oid, type: "SALES_SPLIT" }, select: { createdAt: true } }) : null;
      ok(inRange(comm?.createdAt, target), "commission dated to the sale date (payroll period matches)");
      const t2 = dayRange(-5);
      if (oid) await fetch(BASE + "/api/erp/pos", { method: "PATCH", headers: hdr, body: JSON.stringify({ orderId: oid, staffId: estaff.id, saleDateISO: new Date(t2.start.getTime() + 12 * 3600e3).toISOString(), lines: [{ kind: "SERVICE", description: `${TAG}DATE`, qty: 1, unitAED: 100 }] }) });
      const moved = oid ? await poll(async () => inRange((await prisma.salesOrder.findUnique({ where: { id: oid }, select: { createdAt: true } }))?.createdAt, t2), true) : false;
      ok(moved === true, "edit re-dates the bill to 5 days ago");
      const comm2 = oid ? await prisma.commission.findFirst({ where: { orderId: oid, type: "SALES_SPLIT" }, select: { createdAt: true } }) : null;
      ok(inRange(comm2?.createdAt, t2), "commission re-dated together with the bill");
      const fr = await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ clientRequestId: `${REQ}fut-${Date.now()}`, saleDateISO: new Date(Date.now() + 3 * 864e5).toISOString(), lines: [{ kind: "SERVICE", description: `${TAG}FUT`, qty: 1, unitAED: 50 }] }) });
      ok(fr.status === 400, `future-dated sale rejected (${fr.status})`);
    }

    section("Lockdown: reception + crown-artist page access");
    ok((await code("/erp", "RECEPTION")) === "REDIR", "reception: dashboard blocked (→ bookings)");
    ok((await code("/erp/clients", "RECEPTION")) === "200", "reception: clients 200");
    ok((await code("/erp/inventory", "RECEPTION")) === "200", "reception: inventory 200");
    ok((await code("/erp/sales", "RECEPTION")) === "200", "reception: sales 200");
    ok((await code("/erp/products", "RECEPTION")) === "REDIR", "reception: storefront blocked");
    ok((await code("/erp/settings", "RECEPTION")) === "REDIR", "reception: settings blocked");
    ok((await code("/erp/staff", "RECEPTION")) === "REDIR", "reception: staff blocked");
    ok((await code("/erp/finance", "RECEPTION")) === "REDIR", "reception: finance blocked");
    ok((await code("/erp/clients", "STYLIST")) === "REDIR", "stylist: clients blocked");
    ok((await code("/erp/inventory", "STYLIST")) === "REDIR", "stylist: inventory blocked");
    ok((await code("/erp/staff", "STYLIST")) === "REDIR", "stylist: staff blocked");
    ok((await code("/erp/products", "STYLIST")) === "REDIR", "stylist: storefront blocked");
    ok((await code(`/erp/staff/${estaff.id}`, "ADMIN")) === "200", "staff detail (docs/leave) renders for admin");

    section("Per-service artist on a booking");
    {
      const hdr = await eh("RECEPTION");
      const staff2 = await prisma.staff.findFirst({ where: { active: true, id: { not: estaff.id } }, orderBy: { order: "asc" }, select: { id: true } });
      const svc2 = await prisma.service.findFirst({ where: { active: true, id: { not: esvc.id } }, select: { id: true } });
      const bid = staff2 && svc2 ? (await (await fetch(BASE + "/api/erp/bookings", { method: "POST", headers: hdr, body: JSON.stringify({ services: [{ serviceId: esvc.id, staffId: estaff.id }, { serviceId: svc2.id, staffId: staff2.id }], startISO: new Date(dayRange(1).start.getTime() + 15 * 3600e3).toISOString(), customerName: `${TAG}PerSvc`, phone: "", email: "", serviceMode: "SALON", enforceAvailability: false }) })).json().catch(() => ({})))?.booking?.id : null;
      const items = bid ? await prisma.bookingItem.findMany({ where: { bookingId: bid }, select: { serviceId: true, staffId: true } }) : [];
      const a = items.find((i) => i.serviceId === esvc.id)?.staffId;
      const b2 = items.find((i) => i.serviceId === svc2?.id)?.staffId;
      ok(!!bid && a === estaff.id && b2 === staff2?.id, `create: each service kept its own artist (svc1→${a === estaff.id}, svc2→${b2 === staff2?.id})`);
      // PATCH: swap the two artists → items reflect the new per-service assignment
      if (bid && staff2 && svc2) await fetch(`${BASE}/api/erp/bookings/${bid}`, { method: "PATCH", headers: hdr, body: JSON.stringify({ services: [{ serviceId: esvc.id, staffId: staff2.id }, { serviceId: svc2.id, staffId: estaff.id }] }) });
      const items2 = bid ? await prisma.bookingItem.findMany({ where: { bookingId: bid }, select: { serviceId: true, staffId: true } }) : [];
      const a2 = items2.find((i) => i.serviceId === esvc.id)?.staffId;
      const c2 = items2.find((i) => i.serviceId === svc2?.id)?.staffId;
      ok(a2 === staff2?.id && c2 === estaff.id, `edit: per-service artists swapped (svc1→${a2 === staff2?.id}, svc2→${c2 === estaff.id})`);
    }

    section("Booking main Crown Artist editable + POS→booking sync");
    {
      const hdr = await eh("RECEPTION");
      const s2 = await prisma.staff.findFirst({ where: { active: true, id: { not: estaff.id } }, orderBy: { order: "asc" }, select: { id: true } });
      const bid = (await (await fetch(BASE + "/api/erp/bookings", { method: "POST", headers: hdr, body: JSON.stringify({ services: [{ serviceId: esvc.id }], staffId: estaff.id, startISO: new Date(dayRange(1).start.getTime() + 16 * 3600e3).toISOString(), customerName: `${TAG}MainArt`, phone: "", email: "", serviceMode: "SALON", enforceAvailability: false }) })).json().catch(() => ({})))?.booking?.id;
      const b1 = bid ? await prisma.booking.findUnique({ where: { id: bid }, select: { staffId: true, items: { select: { staffId: true } } } }) : null;
      ok(b1?.staffId === estaff.id && !!b1?.items.length && b1.items.every((i) => i.staffId === estaff.id), "create: booking + items use the main artist");
      // Edit the MAIN artist → booking.staffId updates and the service (left as "main") inherits it
      if (bid && s2) await fetch(`${BASE}/api/erp/bookings/${bid}`, { method: "PATCH", headers: hdr, body: JSON.stringify({ services: [{ serviceId: esvc.id }], staffId: s2.id }) });
      const b2 = bid ? await prisma.booking.findUnique({ where: { id: bid }, select: { staffId: true, items: { select: { staffId: true } } } }) : null;
      ok(b2?.staffId === s2?.id && b2?.items.every((i) => i.staffId === s2?.id), "edit: main artist updated + item inherits it");
      // Bill the booking with the MAIN selector = s2 but the LINE artist = estaff → the booking's
      // Crown Artist must follow the LINE artist (estaff), not the stale main selector.
      const ahdr = await eh();
      await fetch(BASE + "/api/erp/pos", { method: "POST", headers: ahdr, body: JSON.stringify({ bookingId: bid, clientRequestId: `${REQ}mainart-${Date.now()}`, staffId: s2?.id ?? estaff.id, lines: [{ kind: "SERVICE", description: `${TAG}MASVC`, qty: 1, unitAED: 100, staffId: estaff.id, staffIds: [estaff.id] }] }) });
      const synced = bid ? await poll(async () => (await prisma.booking.findUnique({ where: { id: bid }, select: { staffId: true } }))?.staffId, estaff.id) : null;
      ok(synced === estaff.id, "POS: the line artist (not the main selector) drives the booking's Crown Artist");
    }

    section("Staff document routes: SUPER_ADMIN (owner) only");
    {
      // Upload blocked for everyone below owner — incl. managers (ADMIN).
      const upStatus = async (role) => (await fetch(`${BASE}/api/erp/staff/${estaff.id}/documents`, { method: "POST", headers: { cookie: `qa_admin=${await tok(role)}` }, body: new FormData() })).status;
      ok((await upStatus("STYLIST")) === 403, "staff-doc upload: stylist 403");
      ok((await upStatus("RECEPTION")) === 403, "staff-doc upload: reception 403");
      ok((await upStatus("ADMIN")) === 403, "staff-doc upload: manager/ADMIN now blocked (403)");
      ok((await upStatus("SUPER_ADMIN")) === 400, "staff-doc upload: super-admin passes auth+staff, reaches file validation (400 without a file)");
      // Serve/download blocked below owner (incl. ADMIN); inline mode is also gated.
      const dl = async (role, q = "") => (await fetch(`${BASE}/api/erp/staff-doc/nonexistent${q}`, { headers: { cookie: `qa_admin=${await tok(role)}` } })).status;
      ok((await dl("RECEPTION")) === 403, "staff-doc download: reception 403");
      ok((await dl("ADMIN")) === 403, "staff-doc download: manager/ADMIN now blocked (403)");
      ok((await dl("ADMIN", "?inline=1")) === 403, "staff-doc inline preview: manager blocked (403, no ?inline bypass)");
      ok((await dl("SUPER_ADMIN")) === 404, "staff-doc download: super-admin reaches lookup (404 unknown id)");
    }

    section("Client-followups cron secured (no send without secret)");
    ok((await fetch(BASE + "/api/cron/client-followups")).status === 401, "followups cron: 401 without secret (no emails sent)");

    section("SEO blog engine: keyword harvest cron + rotation + FAQ rich snippet");
    {
      // Harvest cron fails closed without the secret (never triggers paid web-search/model calls).
      ok((await fetch(BASE + "/api/cron/harvest-keywords")).status === 401, "harvest cron: 401 without secret");
      // Keyword store is queryable.
      let kwOk = true; try { await prisma.keyword.count(); } catch { kwOk = false; }
      ok(kwOk, "Keyword model queryable");
      // Rotation: seed two keywords with different usage; the least-used one is selected.
      await prisma.keyword.deleteMany({ where: { phrase: { startsWith: "__e2e" } } });
      await prisma.keyword.create({ data: { phrase: "__e2e used kw", cluster: "hair", intent: "informational", timesUsed: 5, lastUsedAt: new Date() } });
      await prisma.keyword.create({ data: { phrase: "__e2e fresh kw", cluster: "hair", intent: "informational", timesUsed: 0 } });
      const { selectKeyword } = await import("../lib/keyword-core.ts");
      const rows = await prisma.keyword.findMany({ where: { phrase: { startsWith: "__e2e" } } });
      ok(selectKeyword(rows)?.phrase === "__e2e fresh kw", "rotation: least-used keyword is picked");
      await prisma.keyword.deleteMany({ where: { phrase: { startsWith: "__e2e" } } });
      // A post with an FAQ renders FAQPage JSON-LD + the visible question on its public page.
      const fslug = "e2e-faq-post";
      await prisma.blogPost.deleteMany({ where: { slug: fslug } });
      const fpost = await prisma.blogPost.create({ data: {
        title: `${TAG}FAQ Post`, slug: fslug, excerpt: "e2e", metaDescription: "e2e",
        contentMarkdown: "## Body\nHello world.", tags: ["e2e"], category: "Beauty Tips",
        faq: [{ q: "Does this E2E question appear?", a: "Yes, it renders in the FAQ and JSON-LD." }],
        targetKeyword: "e2e keyword", status: "PUBLISHED", source: "AI",
      } });
      const page = await fetch(`${BASE}/blog/${fslug}`);
      const html = await page.text();
      ok(page.status === 200 && html.includes("FAQPage"), "blog post: FAQPage JSON-LD present");
      ok(html.includes("Does this E2E question appear?"), "blog post: FAQ question rendered on page");
      await prisma.blogPost.delete({ where: { id: fpost.id } });
    }

    section("Payroll: net = max(commission, base) + referral (not additive)");
    {
      const hdr = await eh();
      const ts = await prisma.staff.create({ data: { name: `${TAG}Payroll`, role: "Crown Artist", salaryAED: 1000, commissionPct: 40, referralPct: 5 } });
      await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ clientRequestId: `${REQ}pay-${Date.now()}`, staffId: ts.id, lines: [{ kind: "SERVICE", description: `${TAG}PAYSVC`, qty: 1, unitAED: 500, staffId: ts.id, staffIds: [ts.id] }] }) });
      // VAT-inclusive: net service = net(500) = 476; commission = 40% of 476 ≈ 190; base 1000 is higher → net pay 1000
      const month = dubaiMonth();
      const net = await poll(async () => {
        const t = await (await fetch(`${BASE}/api/erp/payroll/export?month=${month}`, { headers: hdr })).text();
        const line = t.split("\n").find((l) => l.startsWith(`${TAG}Payroll,`));
        return line ? line.split(",")[8] : null;
      }, "1000");
      ok(net === "1000", `net = max(200 comm, 1000 base) = 1000, not additive 1200 (got ${net})`);
      const services = await poll(async () => {
        const t = await (await fetch(`${BASE}/api/erp/payroll/export?month=${month}`, { headers: hdr })).text();
        const line = t.split("\n").find((l) => l.startsWith(`${TAG}Payroll,`));
        return line ? line.split(",")[2] : null;
      }, String(netFromInclusive(500)));
      ok(services === String(netFromInclusive(500)), `per-person Services column (net, ex-VAT) = ${netFromInclusive(500)} (got ${services})`);
    }

    section("Marketer keeps earnings page; linked artist sees own calendar; others don't");
    {
      const rc = await eh("RECEPTION");
      const mStaff = await prisma.staff.create({ data: { name: `${TAG}Mktr`, role: "Marketing", commissionPct: 40, referralPct: 5 } });
      const mUser = await prisma.adminUser.create({ data: { email: `${TAG}mktr@qa.test`, name: "E2E Marketer", role: "STYLIST", staffId: mStaff.id, passwordHash: "x" } });
      const mTok = await mintTok(mUser.id, "STYLIST");
      ok((await codeTok(`/erp/staff/${mStaff.id}`, mTok)) === "200", "marketer can view own earnings page");
      ok((await codeTok(`/erp/staff/${estaff.id}`, mTok)) === "REDIR", "marketer cannot view another staff's page");

      const aStaff = await prisma.staff.create({ data: { name: `${TAG}Artist`, role: "Crown Artist", commissionPct: 40 } });
      const aUser = await prisma.adminUser.create({ data: { email: `${TAG}artist@qa.test`, name: "E2E Artist", role: "STYLIST", staffId: aStaff.id, passwordHash: "x" } });
      const aTok = await mintTok(aUser.id, "STYLIST");
      ok((await codeTok(`/erp/staff/${aStaff.id}`, aTok)) === "REDIR", "service artist blocked from own earnings page");

      const when = new Date(dayRange(2).start.getTime() + 14 * 3600e3);
      await fetch(BASE + "/api/erp/bookings", { method: "POST", headers: rc, body: JSON.stringify({ services: [{ serviceId: esvc.id, staffId: aStaff.id }], startISO: when.toISOString(), customerName: `${TAG}CalCust`, phone: "", email: "", serviceMode: "SALON", enforceAvailability: false }) });
      const wkISO = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(when);
      const seen = await (await fetch(`${BASE}/erp/calendar?week=${wkISO}`, { headers: { cookie: `qa_admin=${aTok}` } })).text();
      ok(seen.includes(`${TAG}CalCust`), "linked artist sees the booking they performed on their calendar");
      const notSeen = await (await fetch(`${BASE}/erp/calendar?week=${wkISO}`, { headers: { cookie: `qa_admin=${mTok}` } })).text();
      ok(!notSeen.includes(`${TAG}CalCust`), "another artist does NOT see that booking");
    }

    section("Security hardening: allowlists + immediate session revocation");
    {
      // INVESTOR (read-only finance) must not reach the bookings table / client PII, even by URL.
      ok((await codeTok("/erp/bookings", await tok("INVESTOR"))) === "REDIR", "INVESTOR redirected away from /erp/bookings");
      // Crown artist can't pull the whole-salon recent-bookings feed; reception still can.
      const styFeed = await fetch(BASE + "/api/erp/recent-bookings", { headers: { cookie: `qa_admin=${await tok("STYLIST")}` } });
      ok(styFeed.status === 403, `recent-bookings: crown artist blocked (${styFeed.status})`);
      const recFeed = await fetch(BASE + "/api/erp/recent-bookings", { headers: { cookie: `qa_admin=${await tok("RECEPTION")}` } });
      ok(recFeed.status === 200, `recent-bookings: reception allowed (${recFeed.status})`);

      // Deactivating an account revokes its still-valid token immediately (offboarding).
      const su = await prisma.adminUser.create({ data: { email: `${TAG}revoke@qa.test`, name: `${TAG}Revoke`, role: "ADMIN", passwordHash: "x", active: true } });
      const stok = await mintTok(su.id, "ADMIN");
      const before = await fetch(BASE + "/api/erp/recent-bookings", { headers: { cookie: `qa_admin=${stok}` } });
      ok(before.status === 200, `active account's token works (${before.status})`);
      await prisma.adminUser.update({ where: { id: su.id }, data: { active: false } });
      const after = await fetch(BASE + "/api/erp/recent-bookings", { headers: { cookie: `qa_admin=${stok}` } });
      ok(after.status === 401, `deactivated account's token revoked immediately (${after.status})`);
      await prisma.adminUser.delete({ where: { id: su.id } });
    }

    section("Storefront catalog: admin-only + e-commerce fields");
    {
      const jhdr = async (role) => ({ "Content-Type": "application/json", cookie: `qa_admin=${await tok(role)}` });
      // image upload RBAC + validation
      ok((await fetch(BASE + "/api/erp/products/image", { method: "POST", headers: { cookie: `qa_admin=${await tok("RECEPTION")}` }, body: new FormData() })).status === 403, "product image upload: reception blocked (403)");
      ok((await fetch(BASE + "/api/erp/products/image", { method: "POST", headers: { cookie: `qa_admin=${await tok("ADMIN")}` }, body: new FormData() })).status === 400, "product image upload: admin reaches validation (400 no file)");
      // create a product with shop fields (image/description/publish)
      const cr = await fetch(BASE + "/api/erp/inventory", { method: "PUT", headers: await jhdr("ADMIN"), body: JSON.stringify({ name: `${TAG}Extension`, category: "Hair Extensions", saleAED: 1000, qty: 5, retail: true, description: "Premium India hair", imageUrl: "https://example.com/hair.jpg" }) });
      const pid = cr.ok ? (await cr.json())?.product?.id : null;
      const prod = pid ? await prisma.product.findUnique({ where: { id: pid }, select: { retail: true, description: true, imageUrl: true, saleAED: true } }) : null;
      ok(!!prod && prod.retail && prod.description === "Premium India hair" && prod.imageUrl === "https://example.com/hair.jpg" && prod.saleAED === 1000, "product created with shop fields (image/description/publish)");
      ok((await fetch(BASE + "/api/erp/inventory", { method: "PUT", headers: await jhdr("RECEPTION"), body: JSON.stringify({ name: `${TAG}X`, saleAED: 1 }) })).status === 200, "product create via inventory: reception allowed (200)");
      ok((await codeTok("/erp/products", await tok("ADMIN"))) === "200", "storefront catalog page: admin 200");
      ok((await codeTok("/erp/products", await tok("RECEPTION"))) === "REDIR", "storefront catalog page: reception redirected");
      if (pid) { await prisma.stockMovement.deleteMany({ where: { productId: pid } }); await prisma.product.delete({ where: { id: pid } }); }
    }

    section("Biometric attendance: ADMS ingest + PIN mapping");
    {
      const sn = "E2E-DEVICE-1";
      const hs = await fetch(`${BASE}/iclock/cdata?SN=${sn}&options=all`);
      ok(hs.status === 200 && (await hs.text()).includes("GET OPTION FROM"), "ADMS handshake returns device options");
      ok((await fetch(`${BASE}/iclock/cdata`, { method: "POST", body: "x" })).status === 401, "ADMS push without a device SN is rejected (401)");
      const st = await prisma.staff.create({ data: { name: `${TAG}Bio`, role: "Crown Artist", biometricPin: `${REQ}pin1` } });
      const body = `${REQ}pin1\t2026-07-08 10:00:00\t0\t1\n${REQ}pinX\t2026-07-08 10:05:00\t0\t1`;
      const push = await fetch(`${BASE}/iclock/cdata?SN=${sn}&table=ATTLOG`, { method: "POST", headers: { "Content-Type": "text/plain" }, body });
      ok(push.status === 200 && (await push.text()).trim() === "OK", "ADMS push accepted (OK)");
      const mapped = await poll(async () => (await prisma.attendancePunch.findFirst({ where: { pin: `${REQ}pin1` }, select: { staffId: true } }))?.staffId, st.id);
      ok(mapped === st.id, "punch mapped to staff via biometric PIN");
      const unmapped = await prisma.attendancePunch.findFirst({ where: { pin: `${REQ}pinX` }, select: { staffId: true } });
      ok(!!unmapped && unmapped.staffId === null, "unknown PIN stored unmapped (staffId null)");
      await fetch(`${BASE}/iclock/cdata?SN=${sn}&table=ATTLOG`, { method: "POST", headers: { "Content-Type": "text/plain" }, body });
      ok((await prisma.attendancePunch.count({ where: { pin: `${REQ}pin1` } })) === 1, "re-pushed punch is idempotent (no duplicate)");
      ok((await codeTok("/erp/attendance", await tok("ADMIN"))) === "200", "attendance page: admin 200");
      ok((await codeTok("/erp/attendance", await tok("RECEPTION"))) === "REDIR", "attendance page: reception redirected");
      await prisma.attendancePunch.deleteMany({ where: { pin: { startsWith: REQ } } });
      await prisma.staff.delete({ where: { id: st.id } });
    }

    section("Shop: public COD checkout + orders admin");
    {
      const jhdr = async (role) => ({ "Content-Type": "application/json", cookie: `qa_admin=${await tok(role)}` });
      const pslug = `${REQ}shophair-${Date.now()}`;
      const prod = await prisma.product.create({ data: { name: `${TAG}ShopHair`, category: "Hair Extensions", saleAED: 100, qty: 5, retail: true, active: true, imageUrl: "https://example.com/h.jpg", slug: pslug } });
      ok((await fetch(BASE + "/shop", { redirect: "manual" })).status === 200, "public /shop page renders (200)");
      const detail = await fetch(`${BASE}/shop/${pslug}`);
      ok(detail.status === 200 && (await detail.text()).includes(`${TAG}ShopHair`), "public /shop/[slug] shows the product");
      ok((await fetch(`${BASE}/shop/${REQ}nope-xyz`, { redirect: "manual" })).status === 404, "unknown /shop/[slug] → 404");
      const crid = `${REQ}shop-${Date.now()}`;
      const res = await fetch(BASE + "/api/shop/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ productId: prod.id, qty: 10 }], customerName: `${TAG}Buyer`, phone: "0500000000", address: "Villa 1, Dubai", emirate: "Dubai", clientRequestId: crid }) });
      const data = await res.json().catch(() => ({}));
      const oid = data?.order?.id ?? null;
      ok(res.ok && !!oid && data.order.itemCount === 5 && data.order.totalAED === 500, `COD order placed, qty clamped to stock (${data?.order?.itemCount}==5, ${data?.order?.totalAED}==500)`);
      ok((await prisma.product.findUnique({ where: { id: prod.id }, select: { qty: true } }))?.qty === 0, "stock decremented 5→0");
      const dup = await fetch(BASE + "/api/shop/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ productId: prod.id, qty: 1 }], customerName: `${TAG}Buyer`, phone: "0500000000", address: "Villa 1, Dubai", clientRequestId: crid }) });
      ok(dup.ok && (await dup.json().catch(() => ({})))?.order?.id === oid, "idempotent checkout returns the same order (no double-decrement)");
      const oos = await fetch(BASE + "/api/shop/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ productId: prod.id, qty: 1 }], customerName: `${TAG}Buyer2`, phone: "0500000001", address: "Villa 2, Dubai" }) });
      ok(oos.status === 400, `out-of-stock item rejected (${oos.status})`);
      ok((await fetch(`${BASE}/api/erp/shop-orders/${oid}`, { method: "PATCH", headers: await jhdr("STYLIST"), body: JSON.stringify({ status: "CONFIRMED" }) })).status === 403, "shop order status: crown artist blocked (403)");
      const recPatch = await fetch(`${BASE}/api/erp/shop-orders/${oid}`, { method: "PATCH", headers: await jhdr("RECEPTION"), body: JSON.stringify({ status: "CONFIRMED" }) });
      ok(recPatch.ok && (await prisma.shopOrder.findUnique({ where: { id: oid }, select: { status: true } }))?.status === "CONFIRMED", "reception confirms the order");
      await fetch(`${BASE}/api/erp/shop-orders/${oid}`, { method: "PATCH", headers: await jhdr("ADMIN"), body: JSON.stringify({ status: "CANCELLED" }) });
      ok((await prisma.product.findUnique({ where: { id: prod.id }, select: { qty: true } }))?.qty === 5, "cancelling the order restocks (0→5)");
      const revive = await fetch(`${BASE}/api/erp/shop-orders/${oid}`, { method: "PATCH", headers: await jhdr("ADMIN"), body: JSON.stringify({ status: "CONFIRMED" }) });
      ok(revive.status === 409, `cancelled order is terminal — revive blocked (${revive.status})`);
      ok((await prisma.product.findUnique({ where: { id: prod.id }, select: { qty: true } }))?.qty === 5, "no phantom re-deduct after blocked revive (stock stays 5)");
      ok((await codeTok("/erp/orders", await tok("RECEPTION"))) === "200", "shop orders page: reception 200");
      ok((await codeTok("/erp/orders", await tok("STYLIST"))) === "REDIR", "shop orders page: crown artist redirected");
      await prisma.shopOrder.deleteMany({ where: { customerName: { startsWith: `${TAG}Buyer` } } });
      await prisma.stockMovement.deleteMany({ where: { productId: prod.id } });
      await prisma.product.delete({ where: { id: prod.id } });
    }

    section("Dashboard analytics: super-admin only");
    {
      const sa = await (await fetch(BASE + "/erp", { headers: { cookie: `qa_admin=${await tok("SUPER_ADMIN")}` } })).text();
      ok(sa.includes("Heat-Calendar") && sa.includes("Payment Mix") && sa.includes("Crown Dial"), "super-admin sees the analytics charts");
      const adm = await (await fetch(BASE + "/erp", { headers: { cookie: `qa_admin=${await tok("ADMIN")}` } })).text();
      ok(!adm.includes("Heat-Calendar") && adm.includes("This Month"), "admin keeps the plain revenue card (no charts)");
    }

    section("Document vault: SUPER_ADMIN (owner) only");
    {
      let docSchemaOk = true;
      try { await prisma.companyDocument.count(); } catch { docSchemaOk = false; }
      ok(docSchemaOk, "CompanyDocument model queryable");
      const up = async (role) => (await fetch(BASE + "/api/erp/company-docs", { method: "POST", headers: { cookie: `qa_admin=${await tok(role)}` }, body: new FormData() })).status;
      ok((await up("RECEPTION")) === 403, "company-docs upload: reception blocked (403)");
      ok((await up("STYLIST")) === 403, "company-docs upload: crown artist blocked (403)");
      ok((await up("ADMIN")) === 403, "company-docs upload: manager/ADMIN now blocked (403)");
      ok((await up("SUPER_ADMIN")) === 400, "company-docs upload: super-admin reaches validation (400 without title/file)");
      const serveRec = await fetch(BASE + "/api/erp/company-doc/nope", { headers: { cookie: `qa_admin=${await tok("ADMIN")}` } });
      ok(serveRec.status === 403, "company-doc serve: manager/ADMIN blocked (403)");
      const serve404 = await fetch(BASE + "/api/erp/company-doc/nope", { headers: { cookie: `qa_admin=${await tok("SUPER_ADMIN")}` } });
      ok(serve404.status === 404, "company-doc serve: 404 for unknown id (super-admin)");
      // inline mode is still auth-gated (no bypass via ?inline=1)
      const inlRec = await fetch(BASE + "/api/erp/company-doc/nope?inline=1", { headers: { cookie: `qa_admin=${await tok("ADMIN")}` } });
      ok(inlRec.status === 403, "company-doc inline preview: manager blocked (403, no ?inline bypass)");
      const delAdm = await fetch(BASE + "/api/erp/company-doc/nope", { method: "DELETE", headers: { cookie: `qa_admin=${await tok("ADMIN")}` } });
      ok(delAdm.status === 403, "company-doc delete: manager/ADMIN blocked (403)");
      ok((await codeTok("/erp/documents", await tok("SUPER_ADMIN"))) === "200", "documents page: super-admin 200");
      ok((await codeTok("/erp/documents", await tok("ADMIN"))) === "REDIR", "documents page: manager/ADMIN redirected");
      ok((await codeTok("/erp/documents", await tok("RECEPTION"))) === "REDIR", "documents page: reception redirected");
    }

    section("Scheduled payments + reminder cron");
    {
      let schemaOk = true;
      try { await prisma.scheduledPayment.count(); } catch { schemaOk = false; }
      ok(schemaOk, "ScheduledPayment model queryable");

      // The cron must reject unauthenticated calls (guards against accidental/abusive sends).
      const noSecret = await fetch(BASE + "/api/cron/payment-reminders", { redirect: "manual" });
      ok(noSecret.status === 401, `payment-reminders cron: 401 without secret (${noSecret.status})`);

      // Reminder-eligibility rule (mirrors the cron): PENDING, inside its lead window (or overdue),
      // and not reminded within the last 7 days. Verified via the DB selection — we intentionally do
      // NOT invoke the authorized cron here so no real reminder email is sent during tests.
      const D = 86_400_000;
      const at = (days) => new Date(Date.now() + days * D);
      const mk = (label, o) => prisma.scheduledPayment.create({ data: { label: `${TAG}${label}`, category: "RENT", amountAED: 1000, dueDate: o.dueDate, status: o.status ?? "PENDING", reminderSentAt: o.reminderSentAt ?? null, remindDaysBefore: 7 } });
      await mk("SPdue", { dueDate: at(3) });                                // due in 3d → eligible
      await mk("SPfar", { dueDate: at(60) });                              // due in 60d → not yet
      await mk("SPover", { dueDate: at(-5) });                             // overdue → eligible
      await mk("SPrecent", { dueDate: at(2), reminderSentAt: new Date() }); // reminded today → deduped
      await mk("SPpaid", { dueDate: at(3), status: "PAID" });              // paid → excluded

      const rows = await prisma.scheduledPayment.findMany({ where: { label: { startsWith: `${TAG}SP` } } });
      const now = Date.now();
      const dayStr = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
      const du = (due) => Math.round((Date.parse(dayStr(new Date(due)) + "T12:00:00") - Date.parse(dayStr(new Date(now)) + "T12:00:00")) / D);
      const eligible = rows.filter((p) => p.status === "PENDING" && du(p.dueDate) <= p.remindDaysBefore && !(p.reminderSentAt && now - p.reminderSentAt.getTime() < 7 * D)).map((p) => p.label);
      ok(eligible.includes(`${TAG}SPdue`) && eligible.includes(`${TAG}SPover`), "reminder rule selects due-soon + overdue");
      ok(!eligible.includes(`${TAG}SPfar`) && !eligible.includes(`${TAG}SPrecent`) && !eligible.includes(`${TAG}SPpaid`), "reminder rule excludes far-off / recently-reminded / paid");

      await prisma.scheduledPayment.deleteMany({ where: { label: { startsWith: `${TAG}SP` } } });
    }

    section("Booking deposit: optional, non-blocking, reception-confirmed, POS pre-credit");
    {
      const dsvc = await prisma.service.findFirst({ where: { active: true }, select: { id: true, name: true, priceAED: true, durationMin: true } });
      const restoreDeposit = (await prisma.salonSettings.findUnique({ where: { id: "singleton" }, select: { depositAED: true } }))?.depositAED ?? 0;
      const dubaiDay = (off) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + off * 864e5));
      // Find a real public-bookable slot (mid-day, unlikely to clash) a week+ out.
      const findSlot = async (dur) => {
        for (let off = 7; off <= 22; off++) {
          const j = await (await fetch(`${BASE}/api/availability?date=${dubaiDay(off)}&duration=${dur}`)).json().catch(() => ({}));
          if (j.slots?.length) return j.slots[Math.floor(j.slots.length / 2)].iso;
        }
        return null;
      };

      // 1) Deposit ON — the public booking asks for it + returns the bank account, but is NEVER blocked.
      await prisma.salonSettings.upsert({ where: { id: "singleton" }, update: { depositAED: 120 }, create: { id: "singleton", depositAED: 120 } });
      const u1 = Date.now();
      const slotOn = dsvc ? await findSlot(dsvc.durationMin) : null;
      const resOn = slotOn ? await fetch(BASE + "/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceIds: [dsvc.id], startISO: slotOn, customerName: `${TAG}DepON`, email: `${REQ}depon-${u1}@qa.test`, phone: `9710${String(u1).slice(-8)}` }) }) : null;
      const dataOn = resOn ? await resOn.json().catch(() => ({})) : {};
      const bidOn = dataOn?.booking?.id ?? null;
      const expDep = dsvc ? Math.min(120, dsvc.priceAED) : 0;
      ok(!!resOn && resOn.ok && !!bidOn, `deposit ON: booking still completes (non-blocking) — status ${resOn?.status}`);
      ok(dataOn?.deposit?.amountAED === expDep, `deposit ON: asks for ${dataOn?.deposit?.amountAED} == min(120, ${dsvc?.priceAED})`);
      ok(dataOn?.deposit?.iban === "AE090351001327056383001", "deposit ON: response carries the bank IBAN to transfer to");
      const bkOn = bidOn ? await prisma.booking.findUnique({ where: { id: bidOn }, select: { depositAED: true, depositPaidAt: true, status: true } }) : null;
      ok(!!bkOn && bkOn.depositAED === expDep && bkOn.depositPaidAt === null && bkOn.status === "CONFIRMED", `deposit ON: stored depositAED=${bkOn?.depositAED}, pending, confirmed`);

      // 2) Deposit OFF — nothing surfaced, booking works exactly as before.
      await prisma.salonSettings.update({ where: { id: "singleton" }, data: { depositAED: 0 } });
      const u2 = Date.now() + 1;
      const slotOff = dsvc ? await findSlot(dsvc.durationMin) : null;
      const resOff = slotOff ? await fetch(BASE + "/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceIds: [dsvc.id], startISO: slotOff, customerName: `${TAG}DepOFF`, email: `${REQ}depoff-${u2}@qa.test`, phone: `9711${String(u2).slice(-8)}` }) }) : null;
      const dataOff = resOff ? await resOff.json().catch(() => ({})) : {};
      const bidOff = dataOff?.booking?.id ?? null;
      ok(!!resOff && resOff.ok && !!bidOff && dataOff.deposit == null, `deposit OFF: booking completes with no deposit requested (status ${resOff?.status})`);

      // 3) Reception controls the deposit (dedicated endpoint); crown artist is blocked.
      const depBk = await prisma.booking.create({ data: { serviceId: dsvc?.id ?? null, serviceName: `${TAG}DepEP`, priceAED: 300, durationMin: 60, customerName: `${TAG}DepEP`, email: "", phone: "", startAt: new Date(dayRange(3).start.getTime() + 12 * 3600e3), endAt: new Date(dayRange(3).start.getTime() + 13 * 3600e3), status: "CONFIRMED", source: "WALKIN", depositAED: 100 } });
      const depUrl = `/api/erp/bookings/${depBk.id}/deposit`;
      ok((await fetch(BASE + depUrl, { method: "PATCH", headers: await eh("STYLIST"), body: JSON.stringify({ paid: true }) })).status === 403, "deposit endpoint: crown artist blocked (403)");
      const recPaid = await fetch(BASE + depUrl, { method: "PATCH", headers: await eh("RECEPTION"), body: JSON.stringify({ paid: true }) });
      const paidState = await poll(async () => (await prisma.booking.findUnique({ where: { id: depBk.id }, select: { depositPaidAt: true } }))?.depositPaidAt ? "set" : null, "set");
      ok(recPaid.ok && paidState === "set", "deposit endpoint: reception marks it received");
      await fetch(BASE + depUrl, { method: "PATCH", headers: await eh("RECEPTION"), body: JSON.stringify({ depositAED: 50 }) });
      ok((await poll(async () => (await prisma.booking.findUnique({ where: { id: depBk.id }, select: { depositAED: true } }))?.depositAED, 50)) === 50, "deposit endpoint: reception adjusts the amount");
      await fetch(BASE + depUrl, { method: "PATCH", headers: await eh("RECEPTION"), body: JSON.stringify({ depositAED: 0, paid: false }) });
      const waived = await prisma.booking.findUnique({ where: { id: depBk.id }, select: { depositAED: true, depositPaidAt: true } });
      ok(waived?.depositAED === 0 && waived?.depositPaidAt === null, "deposit endpoint: reception can waive it");

      // 4) POS pre-credit — a RECEIVED deposit is collected as the transfer leg; only the balance in cash.
      const posBk = await prisma.booking.create({ data: { serviceId: dsvc?.id ?? null, serviceName: dsvc?.name ?? `${TAG}Svc`, priceAED: 100, durationMin: 60, customerName: `${TAG}DepPOS`, email: "", phone: "", startAt: new Date(dayRange(3).start.getTime() + 15 * 3600e3), endAt: new Date(dayRange(3).start.getTime() + 16 * 3600e3), status: "CONFIRMED", source: "WALKIN", depositAED: 100, depositPaidAt: new Date() } });
      // VAT-inclusive: service 150 = total 150; deposit 100 (transfer) + balance 50 (cash).
      const posRes = await fetch(BASE + "/api/erp/pos", { method: "POST", headers: await eh("RECEPTION"), body: JSON.stringify({ bookingId: posBk.id, clientRequestId: `${REQ}deppos-${u1}`, staffId: estaff.id, splitPayment: true, transferAED: 100, cashAED: 50, cardAED: 0, lines: [{ kind: "SERVICE", description: dsvc?.name ?? `${TAG}Svc`, qty: 1, unitAED: 150, staffIds: [estaff.id] }] }) });
      const oid = posRes.ok ? (await posRes.json())?.order?.id ?? null : null;
      const dbOrder = oid ? await prisma.salesOrder.findUnique({ where: { id: oid }, select: { totalAED: true, transferAED: true, cashAED: true, splitPayment: true } }) : null;
      ok(!!dbOrder && dbOrder.totalAED === 150 && dbOrder.transferAED === 100 && dbOrder.cashAED === 50 && dbOrder.splitPayment,
        `POS: deposit reconciled — total ${dbOrder?.totalAED}==150, deposit as transfer ${dbOrder?.transferAED}==100, balance cash ${dbOrder?.cashAED}==50`);

      // cleanup + restore the setting
      if (oid) { await prisma.commission.deleteMany({ where: { orderId: oid } }); await prisma.salesOrder.delete({ where: { id: oid } }); }
      for (const id of [bidOn, bidOff, depBk.id, posBk.id]) { if (id) await prisma.booking.delete({ where: { id } }).catch(() => {}); }
      await prisma.client.deleteMany({ where: { name: { startsWith: `${TAG}Dep` } } });
      await prisma.salonSettings.update({ where: { id: "singleton" }, data: { depositAED: restoreDeposit } });
    }
  }

  // ── Web analytics (time-on-site beacon + manager dashboard) ────────────────
  section("Web analytics — page beacon (validate/clamp) + manager-only dashboard");
  {
    const turl = BASE + "/api/track/pageview";
    const tpath = `/__e2e-track-${Date.now()}`;
    // Valid beacon → 204, and engaged seconds clamped to the 600s cap.
    const good = await fetch(turl, { method: "POST", body: JSON.stringify({ path: tpath, sec: 99999 }) });
    ok(good.status === 204, `track: valid beacon → 204 (got ${good.status})`);
    const views = await poll(async () => (await prisma.pageStat.findFirst({ where: { path: tpath } }))?.views ?? 0, 1);
    ok(views === 1, `track: beacon recorded exactly one view (views=${views})`);
    const rec = await prisma.pageStat.findFirst({ where: { path: tpath } });
    ok(rec?.engagedSec === 600, `track: engaged seconds clamped to 600 (got ${rec?.engagedSec})`);
    // Junk path (no leading slash) is ignored — never written.
    await fetch(turl, { method: "POST", body: JSON.stringify({ path: "no-slash-junk", sec: 5 }) });
    const junk = await prisma.pageStat.findFirst({ where: { path: { startsWith: "no-slash" } } });
    ok(!junk, "track: junk path (no leading slash) is ignored");
    // Dashboard is managers-only.
    ok((await code("/erp/analytics", "ADMIN")) === "200", "analytics: admin 200");
    ok((await code("/erp/analytics", "RECEPTION")) === "REDIR", "analytics: reception redirected");
    await prisma.pageStat.deleteMany({ where: { OR: [{ path: { startsWith: "/__e2e-track" } }, { path: { startsWith: "no-slash" } }] } });
  }

  // ── ERP AI assistant (conversational data queries) ─────────────────────────
  // Uses the STRUCTURED form ({intent,params}) so it's deterministic and needs no
  // OpenAI key. Verifies the auth gate + that only catalogued intents ever run
  // (an off-catalogue "intent" must collapse to a clarify, never touch the DB).
  section("ERP assistant — auth guard + safe structured queries (no LLM, read-only)");
  {
    const aurl = BASE + "/api/erp/assistant";
    const apost = (t, payload) => fetch(aurl, { method: "POST", headers: { "Content-Type": "application/json", ...(t ? { cookie: `qa_admin=${t}` } : {}) }, body: JSON.stringify(payload) });

    const aUn = await apost(null, { intent: "takings" });
    ok(aUn.status === 401, `assistant: no cookie → 401 (got ${aUn.status})`);

    const aReception = await apost(await tok("RECEPTION"), { intent: "takings" });
    ok(aReception.status === 403, `assistant: RECEPTION → 403 (got ${aReception.status})`);

    const aAdmin = await tok("ADMIN");
    const aTake = await apost(aAdmin, { intent: "takings", params: { range: "today" } });
    const aTakeJ = await aTake.json().catch(() => ({}));
    ok(aTake.status === 200 && aTakeJ.intent === "takings" && typeof aTakeJ.answer === "string" && aTakeJ.answer.length > 0,
      `assistant: ADMIN takings(today) → 200 with answer (intent=${aTakeJ.intent})`);

    const aStock = await apost(aAdmin, { intent: "low_stock" });
    const aStockJ = await aStock.json().catch(() => ({}));
    ok(aStock.status === 200 && aStockJ.intent === "low_stock" && typeof aStockJ.answer === "string",
      "assistant: ADMIN low_stock → 200 with answer");

    const aTop = await apost(aAdmin, { intent: "top_services", params: { range: "month", limit: 3 } });
    const aTopJ = await aTop.json().catch(() => ({}));
    ok(aTop.status === 200 && aTopJ.intent === "top_services", `assistant: ADMIN top_services → 200 (intent=${aTopJ.intent})`);

    const aJunk = await apost(aAdmin, { intent: "raw_sql; DROP TABLE users" });
    const aJunkJ = await aJunk.json().catch(() => ({}));
    ok(aJunk.status === 200 && aJunkJ.intent === null && typeof aJunkJ.answer === "string" && aJunkJ.answer.length > 0,
      `assistant: off-catalogue intent is refused, never runs → clarify (intent=${aJunkJ.intent})`);

    // Free-form tier: SQL must be unreachable over HTTP — only a model-written plan may produce it.
    const aSqlInject = await apost(aAdmin, { intent: "sql", params: { sql: 'SELECT 1 FROM "Client"' } });
    const aSqlInjectJ = await aSqlInject.json().catch(() => ({}));
    ok(aSqlInject.status === 200 && aSqlInjectJ.intent === null,
      `assistant: client-supplied SQL is refused (intent=${aSqlInjectJ.intent})`);

    // A natural-language question must stay fail-soft even with no AI key configured.
    const aFree = await apost(aAdmin, { question: "how many clients came back more than twice in June?" });
    const aFreeJ = await aFree.json().catch(() => ({}));
    ok(aFree.status === 200 && typeof aFreeJ.answer === "string" && aFreeJ.answer.length > 0,
      "assistant: free-form question → 200 with an answer (never 5xx)");

    // The rate limiter must degrade to a friendly 200, never a 429/500. It also must NOT throttle
    // the structured path (no LLM = no cost), or repeated runs would start failing.
    const burst = await Promise.all(Array.from({ length: 30 }, () => apost(aAdmin, { intent: "low_stock" })));
    ok(burst.every((r) => r.status === 200), "assistant: 30-request burst stays 200 (rate limit is fail-soft)");
    const afterBurst = await apost(aAdmin, { intent: "takings", params: { range: "today" } });
    const afterBurstJ = await afterBurst.json().catch(() => ({}));
    ok(afterBurstJ.intent === "takings", "assistant: structured queries are not rate-limited (suite stays repeatable)");
  }

  // (The SQL guard itself — hostile-query battery, secret columns, row cap — is covered
  //  exhaustively by lib/erp-assistant/sql-guard.test.ts, which runs in the same pre-push gate.)

  // ── BOOKING role: bookings + calendar ONLY ─────────────────────────────────
  section("Booking-only role sees bookings + calendar and nothing else");
  {
    const bt = await tok("BOOKING");
    ok((await codeTok("/erp/bookings", bt)) === "200", "booking role: bookings page 200");
    ok((await codeTok("/erp/calendar", bt)) === "200", "booking role: calendar 200");

    // Every money/staff surface must stay closed — this is the whole point of the role.
    const shut = ["/erp", "/erp/sales", "/erp/pos", "/erp/finance", "/erp/finance/pl", "/erp/expenses",
                  "/erp/staff", "/erp/inventory", "/erp/products", "/erp/clients", "/erp/users",
                  "/erp/documents", "/erp/analytics", "/erp/attendance"];
    const leaks = [];
    for (const path of shut) if ((await codeTok(path, bt)) === "200") leaks.push(path);
    ok(leaks.length === 0, `booking role: ${shut.length} sensitive pages blocked${leaks.length ? ` (LEAKED: ${leaks.join(", ")})` : ""}`);

    const posted = await fetch(BASE + "/api/erp/pos", { method: "POST", headers: { "Content-Type": "application/json", cookie: `qa_admin=${bt}` }, body: JSON.stringify({ lines: [] }) });
    ok(posted.status === 403, `booking role: POS API forbidden (got ${posted.status})`);
    const exp = await fetch(BASE + "/api/erp/sales/export", { headers: { cookie: `qa_admin=${bt}` } });
    ok(exp.status === 403, `booking role: sales export forbidden (got ${exp.status})`);
  }

  // ── Finance: budget panel + RBAC ───────────────────────────────────────────
  section("Finance: budget vs actual (managers set it, investor is read-only)");
  {
    const fin = await body("/erp/finance", "SUPER_ADMIN");
    ok(fin.status === 200 && /Budget/.test(fin.text), "finance: budget panel renders for the owner");
    ok(/What you planned to spend/.test(fin.text), "finance: budget panel explains itself");

    const inv = await body("/erp/finance", "INVESTOR");
    ok(inv.status === 200, "finance: investor can view");
    ok(!/Set a budget/.test(inv.text), "finance: investor cannot set budgets (read-only)");
  }

  // ── Inventory: reception can now ADD + EDIT products (RBAC fix) ─────────────
  section("Inventory: reception can create/edit products (was manager-only → 'Could not save')");
  {
    const iurl = BASE + "/api/erp/inventory";
    const put = (t, payload) => fetch(iurl, { method: "PUT", headers: { "Content-Type": "application/json", ...(t ? { cookie: `qa_admin=${t}` } : {}) }, body: JSON.stringify(payload) });
    const prod = { name: `${TAG}INVPROD_${Date.now()}`, category: "Retail / Aftercare", barcode: null, costAED: null, saleAED: null, reorderAt: 3, qty: 0 };

    ok((await put(null, prod)).status === 403, "inventory create: no cookie → blocked");
    ok((await put(await tok("STYLIST"), prod)).status === 403, "inventory create: stylist → 403");

    const rec = await put(await tok("RECEPTION"), prod);
    const rj = await rec.json().catch(() => ({}));
    ok(rec.status === 200 && rj.ok === true, `inventory create: RECEPTION → 200 (was 403) (got ${rec.status})`);

    if (rj.product?.id) {
      const patch = await fetch(iurl, { method: "PATCH", headers: { "Content-Type": "application/json", cookie: `qa_admin=${await tok("RECEPTION")}` }, body: JSON.stringify({ id: rj.product.id, saleAED: 25 }) });
      ok(patch.status === 200, `inventory edit: RECEPTION → 200 (got ${patch.status})`);
      await prisma.stockMovement.deleteMany({ where: { productId: rj.product.id } });
      await prisma.product.deleteMany({ where: { id: rj.product.id } });
    }
  }

  console.log(`\n${fail === 0 ? "ALL CHECKS PASSED ✅" : "REGRESSIONS / FAILURES ❌"}  (${pass} passed, ${fail} failed)`);
} catch (e) {
  console.error("RUNNER ERROR:", e.message);
  fail++;
} finally {
  // Guaranteed cleanup — runs even if a check threw. Leaves the DB exactly as found.
  try {
    const swept = await cleanupSweep();
    const total = swept.orders + swept.bookings + swept.clients + swept.services + swept.staff + swept.users + swept.scheduled + swept.products + swept.shopOrders;
    console.log(`\n🧹 Cleanup sweep: removed ${swept.orders} orders, ${swept.bookings} bookings, ${swept.clients} clients, ${swept.services} services, ${swept.staff} staff, ${swept.users} users, ${swept.scheduled} scheduled payments, ${swept.products} products, ${swept.shopOrders} shop orders${total === 0 ? " (nothing left behind ✅)" : ""}`);
    const residue = await prisma.salesOrder.count({ where: { OR: [{ lines: { some: { description: { startsWith: TAG } } } }, { clientRequestId: { startsWith: REQ } }] } })
      + await prisma.booking.count({ where: { customerName: { startsWith: TAG } } })
      + await prisma.client.count({ where: { name: { startsWith: TAG } } })
      + await prisma.staff.count({ where: { name: { startsWith: TAG } } })
      + await prisma.adminUser.count({ where: { email: { startsWith: TAG } } })
      + await prisma.scheduledPayment.count({ where: { label: { startsWith: TAG } } })
      + await prisma.product.count({ where: { name: { startsWith: TAG } } })
      + await prisma.shopOrder.count({ where: { customerName: { startsWith: TAG } } })
      + await prisma.attendancePunch.count({ where: { pin: { startsWith: REQ } } });
    console.log(residue === 0 ? "✅ Zero test residue in DB." : `❌ RESIDUE REMAINS: ${residue} rows still tagged.`);
    if (residue !== 0) fail++;
  } catch (e) { console.error("cleanup sweep error:", e.message); fail++; }
  await prisma.$disconnect();
}
process.exit(fail === 0 ? 0 : 1);
