import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { salesRange, getSalesBreakdown, getRevenueByKind } from "@/lib/finance";
import { aed } from "@/lib/utils";
import { lineArtistIds } from "@/lib/artists";
import { parsePage, pageWindow } from "@/lib/pagination-core";
import { SalesTable, type SalesRow } from "@/components/erp/SalesTable";
import type { Prisma } from "@prisma/client";

function whenLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales — Qasr Alshar ERP" };

// A bill "touches" a payment method when it's a single bill of that method, or a
// split bill with a non-zero amount in that method's column — mirrors rowMethods().
const AMOUNT_COL: Record<"CASH" | "CARD" | "TRANSFER", "cashAED" | "cardAED" | "transferAED"> = {
  CASH: "cashAED", CARD: "cardAED", TRANSFER: "transferAED",
};

export default async function ErpSales({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; date?: string; from?: string; to?: string; page?: string; q?: string; payment?: string }>;
}) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "RECEPTION"].includes(session.role)) redirect("/erp");
  const canEdit = true; // everyone who can open Sales (admin + reception) may edit a bill

  const sp = await searchParams;
  const range = sp.from && sp.to ? "custom" : sp.date ? "date" : sp.range ?? "today";
  const window = salesRange(sp);
  const q = (sp.q ?? "").trim();
  const payment = (["CASH", "CARD", "TRANSFER"].includes(sp.payment ?? "") ? sp.payment : "ALL") as "ALL" | "CASH" | "CARD" | "TRANSFER";

  // When searching, resolve staff whose NAME matches q so bills can still be found
  // by artist/marketer (stored as ids), matching the old client-side search scope.
  const staffIdsMatchingQ = q
    ? (await prisma.staff.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true } })).map((s) => s.id)
    : [];

  // The table's where: PAID bills in the period, narrowed by the free-text search
  // (invoice / client / phone / artist / cashier / service item) and the payment filter.
  const where: Prisma.SalesOrderWhereInput = {
    status: "PAID",
    createdAt: { gte: window.start, lt: window.end },
    AND: [
      ...(q ? [{ OR: [
        { invoiceNo: { contains: q, mode: "insensitive" as const } },
        { client: { name: { contains: q, mode: "insensitive" as const } } },
        { client: { phone: { contains: q } } },
        { staff: { name: { contains: q, mode: "insensitive" as const } } },        // main artist
        { createdBy: { name: { contains: q, mode: "insensitive" as const } } },     // cashier
        { lines: { some: { description: { contains: q, mode: "insensitive" as const } } } }, // service / item
        ...(staffIdsMatchingQ.length ? [
          { marketerId: { in: staffIdsMatchingQ } },                                // marketer by name
          { lines: { some: { staffIds: { hasSome: staffIdsMatchingQ } } } },        // per-line artists
        ] : []),
      ] }] : []),
      ...(payment !== "ALL" ? [{ OR: [
        { splitPayment: false, paymentMethod: payment },
        { splitPayment: true, [AMOUNT_COL[payment]]: { gt: 0 } },
      ] }] : []),
    ],
  };

  // One page of the filtered set (server-side) — compute the window before the batch.
  const filteredTotal = await prisma.salesOrder.count({ where });
  const win = pageWindow(filteredTotal, parsePage(sp.page));

  const [orders, summary, staffList, byKind] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: win.skip,
      take: win.take,
      include: {
        lines: { select: { description: true, qty: true, unitAED: true, lineAED: true, kind: true, staffId: true, staffIds: true } },
        staff: { select: { name: true } },
        client: { select: { name: true } },
        createdBy: { select: { name: true } },
        booking: { select: { startAt: true, source: true, serviceMode: true, address: true, customRequest: true, notes: true } },
      },
    }),
    getSalesBreakdown(window), // accurate totals for the whole period (never narrowed by search/page)
    prisma.staff.findMany({ select: { id: true, name: true } }),
    getRevenueByKind(window),
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

      {byKind.total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="surface rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-muted">Service revenue</div>
            <div className="mt-1 font-display text-2xl text-cream">{aed(byKind.service)}</div>
            <div className="mt-1 text-xs text-muted">{Math.round((byKind.service / byKind.total) * 100)}% of takings</div>
          </div>
          <div className="surface rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-muted">Product revenue</div>
            <div className="mt-1 font-display text-2xl text-cream">{aed(byKind.product)}</div>
            <div className="mt-1 text-xs text-muted">{Math.round((byKind.product / byKind.total) * 100)}% of takings</div>
          </div>
          <div className="surface rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-muted">Services + products</div>
            <div className="mt-1 font-display text-2xl text-gold-gradient">{aed(byKind.total)}</div>
            <div className="mt-1 text-xs text-muted">gross, this period</div>
          </div>
        </div>
      )}

      <SalesTable
        rows={rows}
        summary={summary}
        activeRange={range}
        activeDate={sp.date ?? null}
        activeFrom={sp.from ?? null}
        activeTo={sp.to ?? null}
        q={q}
        payment={payment}
        total={win.total}
        page={win.page}
        size={win.size}
        canEdit={canEdit}
      />
    </div>
  );
}
