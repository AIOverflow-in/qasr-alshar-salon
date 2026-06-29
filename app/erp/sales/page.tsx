import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { salesRange, getSalesBreakdown } from "@/lib/finance";
import { SalesTable, type SalesRow } from "@/components/erp/SalesTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales — Qasr Alshar ERP" };

const ROW_CAP = 1000; // table shows the most recent N; the summary covers the whole period

export default async function ErpSales({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; date?: string; from?: string; to?: string }>;
}) {
  const ok = await requireRole(["SUPER_ADMIN", "ADMIN", "RECEPTION"]);
  if (!ok) redirect("/erp");

  const sp = await searchParams;
  const range = sp.from && sp.to ? "custom" : sp.date ? "date" : sp.range ?? "today";
  const window = salesRange(sp);

  const [orders, summary] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { status: "PAID", createdAt: { gte: window.start, lt: window.end } },
      orderBy: { createdAt: "desc" },
      take: ROW_CAP,
      include: {
        lines: { select: { description: true } },
        staff: { select: { name: true } },
        client: { select: { name: true } },
      },
    }),
    getSalesBreakdown(window), // accurate totals for the whole period
  ]);

  const rows: SalesRow[] = orders.map((o) => ({
    id: o.id,
    invoiceNo: o.invoiceNo,
    createdAt: o.createdAt.toISOString(),
    client: o.client?.name ?? "Walk-in",
    items: o.lines.map((l) => l.description),
    artist: o.staff?.name ?? "—",
    payment: o.paymentMethod as SalesRow["payment"],
    net: o.subtotalAED,
    vat: o.vatAED,
    total: o.totalAED,
  }));

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
      />
    </div>
  );
}
