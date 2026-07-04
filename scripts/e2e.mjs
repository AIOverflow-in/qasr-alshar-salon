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
  return { orders: oIds.length, bookings: bk.count, clients: cl.count, services: sv.count, staff: stf.count, users: usr.count };
}

try {
  section("Public + ERP pages load");
  ok((await code("/")) === "200", "home 200");
  ok((await code("/book")) === "200", "/book 200");
  ok((await code("/terms")) === "200", "/terms 200");
  ok((await code("/admin/login")) === "200", "/admin/login 200");
  ok((await code("/erp", "RECEPTION")) === "REDIR", "ERP dashboard: reception redirected (dashboard is owner-only now)");

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
        ok(commA === Math.round(170 * A.commissionPct / 100), `A commission ${commA} == round(170×${A.commissionPct}%)`);
        ok(commB === Math.round(30 * B.commissionPct / 100), `B commission ${commB} == round(30×${B.commissionPct}%)`);
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
      const lines = [{ kind: "SERVICE", description: "__E2E_SPLIT_1", qty: 1, unitAED: 100 }, { kind: "SERVICE", description: "__E2E_SPLIT_2", qty: 1, unitAED: 100 }]; // total 210 (200 + 5% VAT)
      // Split that doesn't add up to the total is rejected.
      const bad = await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ splitPayment: true, cashAED: 100, cardAED: 50, transferAED: 0, clientRequestId: `e2e-spbad-${Date.now()}`, lines }) });
      ok(bad.status === 400, `split not summing to total rejected (${bad.status})`);
      // Valid split: cash 110 + card 100 = 210.
      const res = await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ splitPayment: true, cashAED: 110, cardAED: 100, transferAED: 0, clientRequestId: `e2e-sp-${Date.now()}`, lines }) });
      const orderId = (await res.json().catch(() => ({})))?.order?.id;
      const o = orderId ? await prisma.salesOrder.findUnique({ where: { id: orderId }, select: { splitPayment: true, cashAED: true, cardAED: true, transferAED: true, paymentMethod: true, totalAED: true } }) : null;
      ok(!!o && o.splitPayment && o.cashAED === 110 && o.cardAED === 100 && o.transferAED === 0 && o.totalAED === 210, `split stored: cash 110 + card 100 = total ${o?.totalAED}`);
      ok(!!o && o.paymentMethod === "CASH", `dominant method = CASH (${o?.paymentMethod})`);
      // Breakdown building blocks: the split aggregate reads the columns; the single-method bucket excludes it (no double count).
      const splitAgg = await prisma.salesOrder.aggregate({ where: { id: orderId, splitPayment: true }, _sum: { cashAED: true, cardAED: true } });
      ok(splitAgg._sum.cashAED === 110 && splitAgg._sum.cardAED === 100, "breakdown reads split columns");
      ok((await prisma.salesOrder.count({ where: { id: orderId, splitPayment: false } })) === 0, "split bill excluded from single-method bucket");
      if (orderId) { await prisma.commission.deleteMany({ where: { orderId } }); await prisma.salesOrder.delete({ where: { id: orderId } }); }
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
      ok(c1 === Math.round(200 * A.commissionPct / 100), `commission on service only: ${c1} == round(200×${A.commissionPct}%), product excluded`);
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
      const want = Math.round(100 * A.commissionPct / 100); // services-only: 100 × pct, product excluded
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
      const spend = cid ? await poll(async () => (await prisma.client.findUnique({ where: { id: cid }, select: { totalSpentAED: true } }))?.totalSpentAED, 210) : -1;
      const visits = cid ? (await prisma.client.findUnique({ where: { id: cid }, select: { visits: true } }))?.visits : -1;
      ok(spend === 210 && visits === 1, `client after edit: spend ${spend}==210, ${visits}==1 visit (old reversed, new applied)`);
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

    section("Staff document routes: manager-only");
    {
      const st = await tok("STYLIST");
      const up = await fetch(`${BASE}/api/erp/staff/${estaff.id}/documents`, { method: "POST", headers: { cookie: `qa_admin=${st}` }, body: new FormData() });
      ok(up.status === 403, `doc upload: stylist 403 (${up.status})`);
      const rc = await tok("RECEPTION");
      const dl = await fetch(`${BASE}/api/erp/staff-doc/nonexistent`, { headers: { cookie: `qa_admin=${rc}` } });
      ok(dl.status === 403, `doc download: reception 403 (${dl.status})`);
    }

    section("Client-followups cron secured (no send without secret)");
    ok((await fetch(BASE + "/api/cron/client-followups")).status === 401, "followups cron: 401 without secret (no emails sent)");

    section("Payroll: net = max(commission, base) + referral (not additive)");
    {
      const hdr = await eh();
      const ts = await prisma.staff.create({ data: { name: `${TAG}Payroll`, role: "Crown Artist", salaryAED: 1000, commissionPct: 40, referralPct: 5 } });
      await fetch(BASE + "/api/erp/pos", { method: "POST", headers: hdr, body: JSON.stringify({ clientRequestId: `${REQ}pay-${Date.now()}`, staffId: ts.id, lines: [{ kind: "SERVICE", description: `${TAG}PAYSVC`, qty: 1, unitAED: 500, staffId: ts.id, staffIds: [ts.id] }] }) });
      // commission = 40% of 500 = 200; base 1000 is higher → net 1000 (additive would be 1200)
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
      }, "500");
      ok(services === "500", `per-person Services column = 500 (got ${services})`);
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
  }

  console.log(`\n${fail === 0 ? "ALL CHECKS PASSED ✅" : "REGRESSIONS / FAILURES ❌"}  (${pass} passed, ${fail} failed)`);
} catch (e) {
  console.error("RUNNER ERROR:", e.message);
  fail++;
} finally {
  // Guaranteed cleanup — runs even if a check threw. Leaves the DB exactly as found.
  try {
    const swept = await cleanupSweep();
    const total = swept.orders + swept.bookings + swept.clients + swept.services + swept.staff + swept.users;
    console.log(`\n🧹 Cleanup sweep: removed ${swept.orders} orders, ${swept.bookings} bookings, ${swept.clients} clients, ${swept.services} services, ${swept.staff} staff, ${swept.users} users${total === 0 ? " (nothing left behind ✅)" : ""}`);
    const residue = await prisma.salesOrder.count({ where: { OR: [{ lines: { some: { description: { startsWith: TAG } } } }, { clientRequestId: { startsWith: REQ } }] } })
      + await prisma.booking.count({ where: { customerName: { startsWith: TAG } } })
      + await prisma.client.count({ where: { name: { startsWith: TAG } } })
      + await prisma.staff.count({ where: { name: { startsWith: TAG } } })
      + await prisma.adminUser.count({ where: { email: { startsWith: TAG } } });
    console.log(residue === 0 ? "✅ Zero test residue in DB." : `❌ RESIDUE REMAINS: ${residue} rows still tagged.`);
    if (residue !== 0) fail++;
  } catch (e) { console.error("cleanup sweep error:", e.message); fail++; }
  await prisma.$disconnect();
}
process.exit(fail === 0 ? 0 : 1);
