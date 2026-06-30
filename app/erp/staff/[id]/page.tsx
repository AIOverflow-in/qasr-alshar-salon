import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { aed, cn } from "@/lib/utils";
import { lineArtistIds } from "@/lib/artists";
import { currentDubaiMonth, dubaiMonthRange, recentMonths } from "@/lib/payroll";
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
  // Admins see anyone; a Crown Artist may only see their own linked record. Everyone else out.
  if (!isAdmin) {
    const me = await prisma.adminUser.findUnique({ where: { id: session.sub }, select: { staffId: true } });
    if (!me?.staffId || me.staffId !== id) redirect("/erp");
  }

  const staff = await prisma.staff.findUnique({ where: { id }, select: { id: true, name: true, role: true, commissionPct: true } });
  if (!staff) notFound();

  const sp = await searchParams;
  const months = recentMonths(12);
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : currentDubaiMonth();
  const { start, end } = dubaiMonthRange(month);

  const [allLines, commAgg] = await Promise.all([
    prisma.orderLine.findMany({
      where: { kind: "SERVICE", order: { status: "PAID", createdAt: { gte: start, lt: end } } },
      select: {
        description: true, qty: true, unitAED: true, lineAED: true, staffId: true, staffIds: true,
        order: { select: { invoiceNo: true, createdAt: true, staffId: true } },
      },
      orderBy: { order: { createdAt: "desc" } },
      take: LINE_CAP,
    }),
    prisma.commission.aggregate({ where: { staffId: id, createdAt: { gte: start, lt: end } }, _sum: { amountAED: true } }),
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
  const commission = commAgg._sum.amountAED ?? 0;

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

      {/* summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="surface rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted">Services performed</div>
          <div className="mt-1 font-display text-3xl text-cream">{mine.length}</div>
        </div>
        <div className="surface rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted">Revenue (their share)</div>
          <div className="mt-1 font-display text-2xl text-cream">{aed(revenueShare)}</div>
          <div className="mt-1 text-xs text-muted">shared lines split equally</div>
        </div>
        <div className="surface rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted">Commission earned</div>
          <div className="mt-1 font-display text-2xl text-gold-gradient">{aed(commission)}</div>
          <div className="mt-1 text-xs text-muted">matches payroll · {staff.commissionPct}% split</div>
        </div>
      </div>

      {/* services table */}
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
            {mine.length === 0 && (
              <tr><td colSpan={4} className="p-12 text-center text-muted">No services performed in {monthLabel(month)}.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
