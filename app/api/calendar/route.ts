import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calendarToken } from "@/lib/calendar";

export const dynamic = "force-dynamic";

// iCal text escaping (commas, semicolons, backslashes, newlines).
function esc(s: string): string {
  return (s ?? "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
}
// UTC basic format e.g. 20260703T080000Z
function dt(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Public, token-gated iCal feed of upcoming bookings.
 * Subscribe in Google Calendar (Other calendars → From URL), Apple, or Outlook.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token || token !== calendarToken()) return new NextResponse("Forbidden", { status: 403 });

  const from = new Date(Date.now() - 7 * 24 * 3600_000); // include the last week
  const bookings = await prisma.booking.findMany({
    where: { status: "CONFIRMED", startAt: { gte: from } },
    orderBy: { startAt: "asc" },
    take: 1000,
    include: { items: { select: { serviceName: true } }, staff: { select: { name: true } } },
  });

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Qasr Alshar Salon//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Qasr Alshar Bookings",
    "X-WR-TIMEZONE:Asia/Dubai",
  ];
  for (const b of bookings) {
    const services = b.items.map((i) => i.serviceName).join(", ") || b.serviceName;
    const loc = b.serviceMode === "HOME" ? `Home service${b.address ? `: ${b.address}` : ""}` : "Qasr Alshar Salon, Union Metro, Deira, Dubai";
    const desc = [
      `Client: ${b.customerName}`,
      b.phone ? `Phone: ${b.phone}` : "",
      b.staff?.name ? `Artist: ${b.staff.name}` : "",
      b.customRequest ? `Request: ${b.customRequest}` : "",
      b.notes ? `Notes: ${b.notes}` : "",
    ].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@qasralsharsalon.com`,
      `DTSTAMP:${dt(b.createdAt)}`,
      `DTSTART:${dt(b.startAt)}`,
      `DTEND:${dt(b.endAt)}`,
      `SUMMARY:${esc(`${b.customerName} — ${services}`)}`,
      `LOCATION:${esc(loc)}`,
      `DESCRIPTION:${esc(desc)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="qasr-alshar-bookings.ics"',
      "Cache-Control": "no-store",
    },
  });
}
