import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { dubaiRangeForDate } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar — Qasr Alshar ERP" };

const DUBAI = "Asia/Dubai";
const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: DUBAI, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: DUBAI, hour: "numeric", minute: "2-digit", hour12: true });
const dayName = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(new Date(iso + "T00:00:00Z"));
const dayNum = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(iso + "T00:00:00Z"));

// Monday (YYYY-MM-DD) of the week containing dateISO — computed on the Dubai calendar date.
function mondayOf(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sun … 6 Sat
  const back = (dow + 6) % 7;
  const mon = new Date(Date.UTC(y, m - 1, d - back));
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(mon);
}
function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.UTC(y, m - 1, d + days)));
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "RECEPTION", "STYLIST"].includes(session.role)) redirect("/erp");

  // A Crown artist sees their own schedule; managers/reception see the whole salon.
  let onlyStaffId: string | null = null;
  if (session.role === "STYLIST") {
    const me = await prisma.adminUser.findUnique({ where: { id: session.sub }, select: { staffId: true } });
    onlyStaffId = me?.staffId ?? null;
  }

  const sp = await searchParams;
  const ref = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : todayISO();
  const monday = mondayOf(ref);
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysISO(monday, i);
    return { iso, range: dubaiRangeForDate(iso), label: dayName(iso), num: dayNum(iso), isToday: iso === todayISO(), bookings: [] as { time: string; artist: string; service: string; client: string; done: boolean }[] };
  });
  const weekStart = days[0].range.start, weekEnd = days[6].range.end;

  const where: Prisma.BookingWhereInput = { status: { in: ["CONFIRMED", "COMPLETED"] }, startAt: { gte: weekStart, lt: weekEnd }, ...(onlyStaffId ? { staffId: onlyStaffId } : {}) };
  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { startAt: "asc" },
    select: { startAt: true, serviceName: true, customerName: true, status: true, staff: { select: { name: true } } },
  });

  for (const b of bookings) {
    const day = days.find((d) => b.startAt >= d.range.start && b.startAt < d.range.end);
    if (day) day.bookings.push({ time: timeFmt.format(b.startAt), artist: b.staff?.name ?? "Any artist", service: b.serviceName, client: b.customerName, done: b.status === "COMPLETED" });
  }

  const prev = addDaysISO(monday, -7), next = addDaysISO(monday, 7);
  const rangeLabel = `${dayNum(monday)} – ${dayNum(addDaysISO(monday, 6))}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-cream">{onlyStaffId ? "My Calendar" : "Calendar"}</h1>
          <p className="text-sm text-muted">{onlyStaffId ? "Your appointments this week" : "Who’s busy this week"} — {rangeLabel}.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`/erp/calendar?week=${prev}`} className="grid h-9 w-9 place-items-center rounded-lg border border-ink-line text-sand hover:border-gold/50" aria-label="Previous week"><ChevronLeft size={16} /></Link>
          <Link href="/erp/calendar" className="rounded-lg border border-ink-line px-3 py-2 text-xs text-sand hover:border-gold/50">This week</Link>
          <Link href={`/erp/calendar?week=${next}`} className="grid h-9 w-9 place-items-center rounded-lg border border-ink-line text-sand hover:border-gold/50" aria-label="Next week"><ChevronRight size={16} /></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((d) => (
          <div key={d.iso} className={cn("surface min-h-[8rem] rounded-2xl border p-3", d.isToday ? "border-gold/50" : "border-ink-line")}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className={cn("text-sm font-semibold", d.isToday ? "text-gold" : "text-cream")}>{d.label}</span>
              <span className="text-xs text-muted">{d.num}</span>
            </div>
            {d.bookings.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted/60">—</div>
            ) : (
              <ul className="space-y-1.5">
                {d.bookings.map((b, i) => (
                  <li key={i} className={cn("rounded-lg border px-2 py-1.5", b.done ? "border-ink-line/60 bg-ink-card/40" : "border-gold/30 bg-gold/5")}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-gold">{b.time}</span>
                      {b.done && <span className="text-[0.55rem] uppercase tracking-wide text-muted">done</span>}
                    </div>
                    <div className="truncate text-xs text-cream" title={b.artist}>{b.artist}</div>
                    <div className="truncate text-[0.65rem] text-muted" title={`${b.service} · ${b.client}`}>{b.service}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Gold = upcoming · grey = completed. Shows confirmed bookings; cancellations aren’t listed.</p>
    </div>
  );
}
