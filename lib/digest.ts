import "server-only";
import { prisma } from "./prisma";
import { dubaiDayRange, getSalesBreakdown } from "./finance";
import { sendDailySummaryEmail, DIGEST_EMAILS } from "./email";

const DUBAI = "Asia/Dubai";
const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: DUBAI, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(d);
const fmtTime = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: DUBAI, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
const midday = (r: { start: Date }) => new Date(r.start.getTime() + 12 * 3600_000);

/**
 * Build and send the daily takings digest (yesterday's takings + today's schedule)
 * to DIGEST_EMAILS. Shared by the daily-summary cron and the ERP "send now" action.
 * Returns a summary of what was sent.
 */
export async function sendDailyDigest() {
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

  let topArtist: { name: string; revenue: number } | null = null;
  const orderIds = paidOrders.map((o) => o.id);
  if (orderIds.length) {
    const grouped = await prisma.commission.groupBy({
      by: ["staffId"], where: { orderId: { in: orderIds }, type: "SALES_SPLIT" }, _sum: { baseAED: true },
    });
    const top = grouped.sort((a, b) => (b._sum.baseAED ?? 0) - (a._sum.baseAED ?? 0))[0];
    if (top && (top._sum.baseAED ?? 0) > 0) {
      const staff = await prisma.staff.findUnique({ where: { id: top.staffId }, select: { name: true } });
      if (staff) topArtist = { name: staff.name, revenue: top._sum.baseAED ?? 0 };
    }
  }

  const recipients = DIGEST_EMAILS;
  const sent = await sendDailySummaryEmail(recipients, {
    dateLabel: fmtDate(midday(yesterday)),
    count: breakdown.count, total: breakdown.total, net: breakdown.net, vat: breakdown.vat,
    byMethod: breakdown.byMethod,
    topArtist,
    todayLabel: fmtDate(midday(today)),
    todayBookings: todayBookings.map((b) => ({ time: fmtTime(b.startAt), customer: b.customerName, service: b.serviceName, artist: b.staff?.name ?? "Any artist" })),
  });

  return { sent, recipients: recipients.length, bills: breakdown.count, total: breakdown.total, todayBookings: todayBookings.length };
}
