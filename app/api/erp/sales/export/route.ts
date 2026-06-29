import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { salesRange } from "@/lib/finance";

export const dynamic = "force-dynamic";

const dtFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
});

/** Quote a CSV field (wrap + escape double-quotes). */
function csv(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? undefined;
  const date = url.searchParams.get("date") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const { start, end } = salesRange({ range, date, from, to });

  const orders = await prisma.salesOrder.findMany({
    where: { status: "PAID", createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "desc" },
    include: { lines: { select: { description: true, qty: true } }, staff: { select: { name: true } }, client: { select: { name: true } } },
  });

  const header = ["Invoice", "Date & Time (Dubai)", "Client", "Items", "Artist", "Payment", "Net (AED)", "VAT (AED)", "Total (AED)"];
  const lines = orders.map((o) =>
    [
      o.invoiceNo,
      dtFmt.format(o.createdAt),
      o.client?.name ?? "Walk-in",
      o.lines.map((l) => (l.qty > 1 ? `${l.description} x${l.qty}` : l.description)).join("; "),
      o.staff?.name ?? "",
      o.paymentMethod,
      o.subtotalAED,
      o.vatAED,
      o.totalAED,
    ].map(csv).join(",")
  );

  // Totals row
  const totals = orders.reduce((a, o) => ({ net: a.net + o.subtotalAED, vat: a.vat + o.vatAED, total: a.total + o.totalAED }), { net: 0, vat: 0, total: 0 });
  lines.push(["", "", "", "", "", "TOTAL", totals.net, totals.vat, totals.total].map(csv).join(","));

  const body = [header.join(","), ...lines].join("\n");
  const label = date ? date : range ?? "today";

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="qasr-sales-${label}.csv"`,
    },
  });
}
