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

function dubaiMonth() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit" }).format(new Date()); }
function dayRange(off = 0) {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = iso.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d + off) - 4 * 3600e3);
  return { start, end: new Date(start.getTime() + 864e5) };
}

try {
  section("Public + ERP pages load");
  ok((await code("/")) === "200", "home 200");
  ok((await code("/book")) === "200", "/book 200");
  ok((await code("/terms")) === "200", "/terms 200");
  ok((await code("/admin/login")) === "200", "/admin/login 200");
  ok((await code("/erp", "RECEPTION")) === "200", "ERP dashboard (reception) 200");

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
    const comm = (await prisma.commission.aggregate({ _sum: { amountAED: true }, where: { staffId: s.id, createdAt: { gte: start, lt: end } } }))._sum.amountAED ?? 0;
    const { text } = await body(`/api/erp/payroll/export?month=${month}`, "ADMIN");
    const row = text.split("\n").find((l) => l.startsWith(s.name) || l.includes(`"${s.name}"`));
    const net = row ? Number(row.split(",").slice(-2, -1)[0]) : NaN;
    ok(net === 5000 + comm + 500 - 200, `net ${net} == 5000+${comm}+500−200`);
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

  section("Bill edit (PATCH /api/erp/pos) is admin-only");
  {
    const patch = async (role) => {
      const t = role ? await tok(role) : null;
      const r = await fetch(BASE + "/api/erp/pos", { method: "PATCH", headers: { "Content-Type": "application/json", ...(t ? { cookie: `qa_admin=${t}` } : {}) }, body: JSON.stringify({}) });
      return r.status;
    };
    ok((await patch("RECEPTION")) === 403, "edit bill: reception 403");
    ok((await patch("STYLIST")) === 403, "edit bill: stylist 403");
    ok((await patch(null)) === 401, "edit bill: unauth 401");
    const adminStatus = await patch("ADMIN"); // passes role gate → 400 on empty body (not 403)
    ok(adminStatus !== 403 && adminStatus !== 401, `edit bill: admin passes role gate (got ${adminStatus})`);
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

  console.log(`\n${fail === 0 ? "ALL CHECKS PASSED ✅" : "REGRESSIONS / FAILURES ❌"}  (${pass} passed, ${fail} failed)`);
} catch (e) {
  console.error("RUNNER ERROR:", e.message);
  fail++;
} finally {
  await prisma.$disconnect();
}
process.exit(fail === 0 ? 0 : 1);
