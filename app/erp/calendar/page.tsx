import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { dubaiRangeForDate } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarStaffFilter } from "@/components/erp/CalendarStaffFilter";
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

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string; staff?: string }> }) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "RECEPTION", "STYLIST", "BOOKING"].includes(session.role)) redirect("/erp");

  // A Crown artist sees their own schedule; managers/reception see the whole salon.
  let onlyStaffId: string | null = null;
  let stylistUnlinked = false; // a STYLIST with no linked Staff record must see NOTHING (fail closed)
  if (session.role === "STYLIST") {
    const me = await prisma.adminUser.findUnique({ where: { id: session.sub }, select: { staffId: true } });
    onlyStaffId = me?.staffId ?? null;
    if (!onlyStaffId) stylistUnlinked = true;
  }

  const sp = await searchParams;

  // Managers can narrow the whole-salon view to one artist. Never offered to a STYLIST — their
  // view is already locked to themselves, and letting them pass ?staff= would leak the salon.
  const isManager = session.role === "SUPER_ADMIN" || session.role === "ADMIN";
  const staffList = isManager
    ? await prisma.staff.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true } })
    : [];
  // Validate against the real list so an arbitrary ?staff= can't be injected.
  const pickedStaff = isManager && sp.staff && staffList.some((s) => s.id === sp.staff) ? sp.staff : "";
  const pickedName = staffList.find((s) => s.id === pickedStaff)?.name ?? "";
  // The filter reuses the artist's own attribution rules below.
  const filterStaffId = onlyStaffId ?? (pickedStaff || null);
  const ref = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : todayISO();
  const monday = mondayOf(ref);
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysISO(monday, i);
    return { iso, range: dubaiRangeForDate(iso), label: dayName(iso), num: dayNum(iso), isToday: iso === todayISO(), bookings: [] as { time: string; artist: string; service: string; client: string; done: boolean }[] };
  });
  const weekStart = days[0].range.start, weekEnd = days[6].range.end;

  // A crown artist sees any booking they were part of, by any signal:
  //  - the booking's main artist (staffId) or the one who referred it (marketerId)
  //  - a per-service artist on a booking item (items.staffId)
  //  - an artist on the linked bill's service lines (salesOrders.lines.staffIds) — catches a
  //    secondary artist on a SHARED service, whose attribution lives only on the bill.
  const where: Prisma.BookingWhereInput = {
    status: { in: ["CONFIRMED", "COMPLETED"] },
    startAt: { gte: weekStart, lt: weekEnd },
    ...(stylistUnlinked
      ? { id: "__none__" } // unlinked crown artist → no results, never the whole salon
      : filterStaffId
      ? {
          OR: [
            { staffId: filterStaffId },
            { marketerId: filterStaffId },
            { items: { some: { staffId: filterStaffId } } },
            { salesOrders: { some: { lines: { some: { staffIds: { has: filterStaffId } } } } } },
          ],
        }
      : {}),
  };
  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { startAt: "asc" },
    select: {
      startAt: true, serviceName: true, customerName: true, status: true, staffId: true, marketerId: true,
      staff: { select: { name: true } },
      items: { select: { serviceName: true, staffId: true } },
    },
  });

  for (const b of bookings) {
    const day = days.find((d) => b.startAt >= d.range.start && b.startAt < d.range.end);
    if (!day) continue;
    // When the view is scoped to one artist — their own calendar, or a manager filtering by them —
    // show the service(s) THAT artist performed on the booking rather than the booking headline.
    let service = b.serviceName;
    if (filterStaffId) {
      const mine = b.items.filter((it) => it.staffId === filterStaffId).map((it) => it.serviceName);
      if (mine.length) service = mine.join(", ");
      else if (b.marketerId === filterStaffId && b.staffId !== filterStaffId) service = `${b.serviceName} · referred`;
    }
    day.bookings.push({ time: timeFmt.format(b.startAt), artist: b.staff?.name ?? "Any artist", service, client: b.customerName, done: b.status === "COMPLETED" });
  }

  const prev = addDaysISO(monday, -7), next = addDaysISO(monday, 7);
  const rangeLabel = `${dayNum(monday)} – ${dayNum(addDaysISO(monday, 6))}`;
  // Week navigation keeps whichever artist is selected.
  const staffQ = pickedStaff ? `&staff=${pickedStaff}` : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-cream">{onlyStaffId ? "My Calendar" : pickedName || "Calendar"}</h1>
          <p className="text-sm text-muted">
            {onlyStaffId ? "Your appointments this week" : pickedName ? `${pickedName}’s appointments this week` : "Who’s busy this week"} — {rangeLabel}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {isManager && <CalendarStaffFilter staff={staffList} selected={pickedStaff} week={sp.week} />}
          <Link href={`/erp/calendar?week=${prev}${staffQ}`} className="grid h-9 w-9 place-items-center rounded-lg border border-ink-line text-sand hover:border-gold/50" aria-label="Previous week"><ChevronLeft size={16} /></Link>
          <Link href={pickedStaff ? `/erp/calendar?staff=${pickedStaff}` : "/erp/calendar"} className="rounded-lg border border-ink-line px-3 py-2 text-xs text-sand hover:border-gold/50">This week</Link>
          <Link href={`/erp/calendar?week=${next}${staffQ}`} className="grid h-9 w-9 place-items-center rounded-lg border border-ink-line text-sand hover:border-gold/50" aria-label="Next week"><ChevronRight size={16} /></Link>
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
