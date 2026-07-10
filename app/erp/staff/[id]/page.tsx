import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sessionIsMarketer } from "@/lib/staff-access";
import { aed, cn } from "@/lib/utils";
import { lineArtistIds } from "@/lib/artists";
import { currentDubaiMonth, dubaiMonthRange, recentMonths } from "@/lib/payroll";
import { leaveSummary } from "@/lib/leave";
import { inlineKind } from "@/lib/file-preview-core";
import { StaffAdmin } from "@/components/erp/StaffAdmin";
import { ArrowLeft, Printer, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const LINE_CAP = 5000; // safety cap on lines scanned for a month

function dt(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}
function monthLabel(m: string) {
  const [y, mm] = m.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, mm - 1, 1)));
}

export default async function ArtistPerformance({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const isAdmin = session.role === "SUPER_ADMIN" || session.role === "ADMIN";
  // Admins see anyone. Among crown artists, only a MARKETER may see their own earnings page;
  // service artists are calendar-only (per the lockdown). Everyone else out.
  if (!isAdmin) {
    const { isMarketer, staffId } = await sessionIsMarketer(session.sub);
    if (!(isMarketer && staffId === id)) redirect(session.role === "STYLIST" ? "/erp/calendar" : "/erp");
  }

  const staff = await prisma.staff.findUnique({ where: { id }, select: { id: true, name: true, role: true, commissionPct: true, referralPct: true, joinedOn: true } });
  if (!staff) notFound();

  const sp = await searchParams;
  const months = recentMonths(12);
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : currentDubaiMonth();
  const { start, end } = dubaiMonthRange(month);

  const [allLines, comms] = await Promise.all([
    prisma.orderLine.findMany({
      where: { kind: "SERVICE", order: { status: "PAID", createdAt: { gte: start, lt: end } } },
      select: {
        description: true, qty: true, unitAED: true, lineAED: true, staffId: true, staffIds: true,
        order: { select: { invoiceNo: true, createdAt: true, staffId: true } },
      },
      orderBy: { order: { createdAt: "desc" } },
      take: LINE_CAP,
    }),
    prisma.commission.findMany({ where: { staffId: id, createdAt: { gte: start, lt: end } }, select: { type: true, amountAED: true, orderId: true, createdAt: true } }),
  ]);

  // Keep only the lines this artist performed, using the same fallback the commission engine uses.
  const mine = allLines.flatMap((l) => {
    const artistIds = lineArtistIds(l, l.order.staffId);
    if (!artistIds.includes(id)) return [];
    return [{
      description: l.description,
      qty: l.qty,
      unitAED: l.unitAED,
      lineAED: l.lineAED,
      share: Math.round(l.lineAED / artistIds.length), // equal split when shared
      shared: artistIds.length > 1,
      when: l.order.createdAt,
      invoiceNo: l.order.invoiceNo,
    }];
  });

  const revenueShare = mine.reduce((s, m) => s + m.share, 0);

  // Commission splits by kind: sales-split (earned as an artist) vs referral (earned as a marketer).
  const referralComms = comms.filter((c) => c.type === "REFERRAL");
  const referralSum = referralComms.reduce((s, c) => s + c.amountAED, 0);
  const splitSum = comms.filter((c) => c.type !== "REFERRAL").reduce((s, c) => s + c.amountAED, 0);
  const commission = splitSum + referralSum;
  // Label the commission by what actually earned it, instead of assuming the 40% artist split.
  const commissionLabel = [splitSum > 0 ? `${staff.commissionPct}% split` : null, referralSum > 0 ? `${staff.referralPct}% referral` : null].filter(Boolean).join(" + ") || `${staff.commissionPct}% split`;

  // Referral activity: the leads this person brought in, resolved to invoice + client.
  const refOrderIds = referralComms.map((c) => c.orderId);
  const refOrders = refOrderIds.length
    ? await prisma.salesOrder.findMany({ where: { id: { in: refOrderIds } }, select: { id: true, invoiceNo: true, createdAt: true, client: { select: { name: true } } } })
    : [];
  const refOrderMap = new Map(refOrders.map((o) => [o.id, o] as const));
  const referrals = referralComms
    .map((c) => { const o = refOrderMap.get(c.orderId); return { when: o?.createdAt ?? c.createdAt, client: o?.client?.name ?? "Walk-in", invoiceNo: o?.invoiceNo ?? "—", amount: c.amountAED }; })
    .sort((a, b) => b.when.getTime() - a.when.getTime());

  // Leave — managers (ADMIN+). Documents (passport/ID scans) — owner/SUPER_ADMIN ONLY.
  const isSuperAdmin = session.role === "SUPER_ADMIN";
  let documents: { id: string; type: string; expiry: string | null; uploadedAt: string; kind: "image" | "pdf" | "other" }[] = [];
  let leaves: { id: string; startDate: string; endDate: string; days: number; type: string; note: string | null }[] = [];
  let leaveSum = { eligible: false, entitlement: 0, taken: 0, remaining: 0 };
  if (isAdmin) {
    const lv = await prisma.staffLeave.findMany({ where: { staffId: id }, orderBy: { startDate: "desc" }, select: { id: true, startDate: true, endDate: true, days: true, type: true, note: true } });
    leaveSum = leaveSummary(staff.joinedOn, lv);
    leaves = lv.map((l) => ({ id: l.id, startDate: l.startDate.toISOString(), endDate: l.endDate.toISOString(), days: l.days, type: l.type, note: l.note }));
    if (isSuperAdmin) {
      // pathname carries the original extension → derive the preview kind without exposing the raw Blob URL.
      const docs = await prisma.staffDocument.findMany({ where: { staffId: id }, orderBy: { uploadedAt: "desc" }, select: { id: true, type: true, expiry: true, uploadedAt: true, pathname: true } });
      documents = docs.map((d) => ({ id: d.id, type: d.type, expiry: d.expiry?.toISOString() ?? null, uploadedAt: d.uploadedAt.toISOString(), kind: inlineKind(d.pathname) }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {isAdmin && (
            <Link href="/erp/staff" className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-gold"><ArrowLeft size={13} /> Staff</Link>
          )}
          <h1 className="font-display text-3xl text-cream">{staff.name}</h1>
          <p className="text-sm text-muted">{staff.role} · work performed in {monthLabel(month)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {months.map((m) => (
            <Link
              key={m}
              href={`/erp/staff/${id}?month=${m}`}
              className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", m === month ? "border-gold bg-gold/15 text-gold" : "border-ink-line text-sand hover:border-gold/50")}
            >
              {monthLabel(m)}
            </Link>
          ))}
        </div>
      </div>

      {/* summary — shows the artist side, the marketer side, or both, depending on activity */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(mine.length > 0 || referrals.length === 0) && (
          <>
            <div className="surface rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wider text-muted">Services performed</div>
              <div className="mt-1 font-display text-3xl text-cream">{mine.length}</div>
            </div>
            <div className="surface rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wider text-muted">Revenue (their share)</div>
              <div className="mt-1 font-display text-2xl text-cream">{aed(revenueShare)}</div>
              <div className="mt-1 text-xs text-muted">shared lines split equally</div>
            </div>
          </>
        )}
        {referrals.length > 0 && (
          <div className="surface rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-muted">Leads referred</div>
            <div className="mt-1 font-display text-3xl text-cream">{referrals.length}</div>
            <div className="mt-1 text-xs text-muted">bookings brought in</div>
          </div>
        )}
        <div className="surface rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted">Commission earned</div>
          <div className="mt-1 font-display text-2xl text-gold-gradient">{aed(commission)}</div>
          <div className="mt-1 text-xs text-muted">matches payroll · {commissionLabel}</div>
        </div>
      </div>

      {/* services table — only when this person performed services */}
      {mine.length > 0 && (
      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-ink-line text-left text-muted">
            <tr>
              <th className="p-4 font-medium">When</th>
              <th className="p-4 font-medium">Service</th>
              <th className="p-4 font-medium">Invoice</th>
              <th className="p-4 text-right font-medium">Their share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line/60">
            {mine.map((m, i) => (
              <tr key={i} className="transition-colors hover:bg-gold/5">
                <td className="whitespace-nowrap p-4 text-gold">{dt(m.when)}</td>
                <td className="p-4 text-cream">
                  {m.description}
                  {m.shared && <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-ink-line px-2 py-0.5 text-[0.6rem] text-muted"><Users size={10} /> shared</span>}
                  <div className="text-xs text-muted">{m.qty} × {aed(m.unitAED)} = {aed(m.lineAED)}</div>
                </td>
                <td className="whitespace-nowrap p-4">
                  <a href={`/api/erp/invoice/${m.invoiceNo}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-gold hover:underline">
                    <Printer size={12} /> {m.invoiceNo}
                  </a>
                </td>
                <td className="whitespace-nowrap p-4 text-right font-semibold tabular-nums text-cream">{aed(m.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* referrals table — leads this person brought in as a marketer */}
      {referrals.length > 0 && (
      <div className="surface overflow-x-auto rounded-2xl">
        <div className="border-b border-ink-line p-4 text-sm font-medium text-cream">Leads referred · {staff.referralPct}% referral</div>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-ink-line text-left text-muted">
            <tr>
              <th className="p-4 font-medium">When</th>
              <th className="p-4 font-medium">Client</th>
              <th className="p-4 font-medium">Invoice</th>
              <th className="p-4 text-right font-medium">Referral earned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line/60">
            {referrals.map((r, i) => (
              <tr key={i} className="transition-colors hover:bg-gold/5">
                <td className="whitespace-nowrap p-4 text-gold">{dt(r.when)}</td>
                <td className="p-4 text-cream">{r.client}</td>
                <td className="whitespace-nowrap p-4">
                  <a href={`/api/erp/invoice/${r.invoiceNo}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-gold hover:underline">
                    <Printer size={12} /> {r.invoiceNo}
                  </a>
                </td>
                <td className="whitespace-nowrap p-4 text-right font-semibold tabular-nums text-cream">{aed(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {mine.length === 0 && referrals.length === 0 && (
        <div className="surface rounded-2xl p-12 text-center text-muted">No activity in {monthLabel(month)}.</div>
      )}

      {/* Personnel — leave (managers) + documents (owner only) */}
      {isAdmin && (
        <div className="space-y-3 border-t border-ink-line pt-6">
          <h2 className="font-display text-xl text-cream">Personnel</h2>
          <StaffAdmin staffId={id} documents={documents} leaves={leaves} summary={leaveSum} canViewDocs={isSuperAdmin} />
        </div>
      )}
    </div>
  );
}
