import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { FINANCE_ROLES } from "@/lib/auth";
import { getProfitAndLoss } from "@/lib/finance";
import { resolvePLRange, buildPLCsv } from "@/lib/pl-core";
import { buildProfitAndLossPdf } from "@/lib/pl-pdf";

export const dynamic = "force-dynamic";

/** Download the P&L for a period as PDF (default) or CSV. Finance roles only. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(FINANCE_ROLES as string[]).includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const period = resolvePLRange({
    period: url.searchParams.get("period") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const report = await getProfitAndLoss(period);
  const format = (url.searchParams.get("format") ?? "pdf").toLowerCase();
  const fileBase = `qasr-alshar-pl-${period.from}_to_${period.to}`;

  if (format === "csv") {
    const csv = buildPLCsv(report, period);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBase}.csv"`,
      },
    });
  }

  const generatedLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date());
  const bytes = await buildProfitAndLossPdf(report, { periodLabel: period.label, from: period.from, to: period.to, generatedLabel });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileBase}.pdf"`,
    },
  });
}
