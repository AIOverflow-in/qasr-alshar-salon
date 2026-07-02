import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dubaiDayRange, getSalesBreakdown } from "@/lib/finance";
import { sendDailySummaryEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail CLOSED in production: a missing secret must never leave the endpoint open.
  // In dev, allow without a secret for convenience.
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const token = url.searchParams.get("secret") || auth?.replace(/^Bearer\s+/i, "");
  return token === secret;
}

const DUBAI = "Asia/Dubai";
const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: DUBAI, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(d);
const fmtTime = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: DUBAI, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
// A safe instant well inside the Dubai day, for labelling (avoids midnight-edge drift).
const midday = (r: { start: Date }) => new Date(r.start.getTime() + 12 * 3600_000);

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Exactly one deployment sends the digest (two projects share one DB → no double-send).
  // Mirrors the blog cron: the ERP-only deployment skips.
  if ((process.env.DEPLOY_TARGET || "all") === "erp") {
    return NextResponse.json({ ok: true, skipped: "erp deployment does not send the digest" });
  }

  const yesterday = dubaiDayRange(-1);
  const today = dubaiDayRange(0);

  const [breakdown, paidOrders, todayBookings] = await Promise.all([
    getSalesBreakdown(yesterday),
    prisma.salesOrder.findMany({ where: { status: "PAID", createdAt: { gte: yesterday.start, lt: yesterday.end } }, select: { id: true } }),
    prisma.booking.findMany({
      where: { status: "CONFIRMED", startAt: { gte: today.start, lt: today.end } },
      orderBy: { startAt: "asc" },
      select: { startAt: true, customerName: true, serviceName: true, staff: { select: { name: true } } },
    }),
  ]);

  // Busiest artist yesterday = most service revenue credited (Commission has no order relation).
  let topArtist: { name: string; revenue: number } | null = null;
  const orderIds = paidOrders.map((o) => o.id);
  if (orderIds.length) {
    const grouped = await prisma.commission.groupBy({
      by: ["staffId"],
      where: { orderId: { in: orderIds }, type: "SALES_SPLIT" },
      _sum: { baseAED: true },
    });
    const top = grouped.sort((a, b) => (b._sum.baseAED ?? 0) - (a._sum.baseAED ?? 0))[0];
    if (top && (top._sum.baseAED ?? 0) > 0) {
      const staff = await prisma.staff.findUnique({ where: { id: top.staffId }, select: { name: true } });
      if (staff) topArtist = { name: staff.name, revenue: top._sum.baseAED ?? 0 };
    }
  }

  const recipients = (process.env.DIGEST_RECIPIENTS || "jacquelineekumba2010@gmail.com,aioverflow.ml@gmail.com")
    .split(",").map((s) => s.trim()).filter(Boolean);

  const sent = await sendDailySummaryEmail(recipients, {
    dateLabel: fmtDate(midday(yesterday)),
    count: breakdown.count, total: breakdown.total, net: breakdown.net, vat: breakdown.vat,
    byMethod: breakdown.byMethod,
    topArtist,
    todayLabel: fmtDate(midday(today)),
    todayBookings: todayBookings.map((b) => ({ time: fmtTime(b.startAt), customer: b.customerName, service: b.serviceName, artist: b.staff?.name ?? "Any artist" })),
  });

  return NextResponse.json({ ok: true, sent, recipients: recipients.length, bills: breakdown.count, total: breakdown.total, todayBookings: todayBookings.length });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
