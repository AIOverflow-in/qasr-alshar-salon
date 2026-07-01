import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { salesRange, getSalesBreakdown } from "@/lib/finance";
import { lineArtistIds } from "@/lib/artists";
import { SalesTable, type SalesRow } from "@/components/erp/SalesTable";

function whenLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales — Qasr Alshar ERP" };

const ROW_CAP = 1000; // table shows the most recent N; the summary covers the whole period

export default async function ErpSales({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; date?: string; from?: string; to?: string }>;
}) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "RECEPTION"].includes(session.role)) redirect("/erp");
  const canEdit = true; // everyone who can open Sales (admin + reception) may edit a bill

  const sp = await searchParams;
  const range = sp.from && sp.to ? "custom" : sp.date ? "date" : sp.range ?? "today";
  const window = salesRange(sp);

  const [orders, summary, staffList] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { status: "PAID", createdAt: { gte: window.start, lt: window.end } },
      orderBy: { createdAt: "desc" },
      take: ROW_CAP,
      include: {
        lines: { select: { description: true, qty: true, unitAED: true, lineAED: true, kind: true, staffId: true, staffIds: true } },
        staff: { select: { name: true } },
        client: { select: { name: true } },
        createdBy: { select: { name: true } },
        booking: { select: { startAt: true, source: true, serviceMode: true, address: true, customRequest: true, notes: true } },
      },
    }),
    getSalesBreakdown(window), // accurate totals for the whole period
    prisma.staff.findMany({ select: { id: true, name: true } }),
  ]);

  const staffMap = new Map(staffList.map((s) => [s.id, s.name] as const));
  const nameOf = (id: string) => staffMap.get(id);

  const rows: SalesRow[] = orders.map((o) => {
    const lines = o.lines.map((l) => {
      const artistNames = lineArtistIds(l, o.staffId).map((id) => nameOf(id)).filter((n): n is string => !!n);
      return { description: l.description, qty: l.qty, unitAED: l.unitAED, lineAED: l.lineAED, kind: l.kind, artists: l.kind === "PRODUCT" ? [] : artistNames };
    });
    const artists = [...new Set(lines.flatMap((l) => l.artists))];
    return {
      id: o.id,
      invoiceNo: o.invoiceNo,
      createdAt: o.createdAt.toISOString(),
      client: o.client?.name ?? "Walk-in",
      items: o.lines.map((l) => l.description),
      lines,
      artists,
      artist: artists[0] ?? o.staff?.name ?? "—",
      payment: o.paymentMethod as SalesRow["payment"],
      splitPayment: o.splitPayment,
      cashAED: o.cashAED,
      cardAED: o.cardAED,
      transferAED: o.transferAED,
      marketer: o.marketerId ? (nameOf(o.marketerId) ?? null) : null,
      marketerPct: o.marketerPct,
      net: o.subtotalAED,
      vat: o.vatAED,
      total: o.totalAED,
      cashier: o.createdBy?.name ?? null,
      notes: o.notes,
      booking: o.booking
        ? { whenLabel: whenLabel(o.booking.startAt), source: o.booking.source, serviceMode: o.booking.serviceMode, address: o.booking.address, customRequest: o.booking.customRequest, notes: o.booking.notes }
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Sales</h1>
        <p className="text-sm text-muted">Every completed bill — filter by period, see takings, and reprint.</p>
      </div>

      <SalesTable
        rows={rows}
        summary={summary}
        activeRange={range}
        activeDate={sp.date ?? null}
        activeFrom={sp.from ?? null}
        activeTo={sp.to ?? null}
        capped={rows.length >= ROW_CAP}
        canEdit={canEdit}
      />
    </div>
  );
}
