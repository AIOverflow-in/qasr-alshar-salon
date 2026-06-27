import { prisma } from "./prisma";
import { BookingStatus } from "@prisma/client";

/** Dubai has no DST — a fixed +04:00 offset is correct year-round. */
export const DUBAI_OFFSET = "+04:00";

/** Build a UTC instant from a Dubai wall-clock date + time. */
export function dubaiInstant(dateISO: string, time: string): Date {
  return new Date(`${dateISO}T${time}:00${DUBAI_OFFSET}`);
}

/** Weekday (0=Sun … 6=Sat) of a Dubai calendar date. */
export function dubaiWeekday(dateISO: string): number {
  // noon Dubai stays on the same calendar date in UTC
  return new Date(`${dateISO}T12:00:00${DUBAI_OFFSET}`).getUTCDay();
}

function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60_000);
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type Slot = { time: string; iso: string };

const DAY_PREFIX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
/** Map a staff off-day label ("Wednesdays", "Tue", …) to a weekday number, or -1. */
function offDayWeekday(label?: string | null): number {
  if (!label) return -1;
  const t = label.trim().toLowerCase();
  return DAY_PREFIX.findIndex((d) => t.startsWith(d));
}

/**
 * Compute bookable start times for a service on a given Dubai date.
 * When `staffId` is given, capacity is 1 (that artist can do one client at a time)
 * and their day-off is excluded. Otherwise salon-wide `capacity` applies.
 */
export async function getAvailableSlots(
  dateISO: string,
  durationMin: number,
  staffId?: string | null
): Promise<Slot[]> {
  const [settings, hours] = await Promise.all([
    prisma.salonSettings.findUnique({ where: { id: "singleton" } }),
    prisma.workingHours.findUnique({ where: { weekday: dubaiWeekday(dateISO) } }),
  ]);

  const slotMinutes = settings?.slotMinutes ?? 30;
  const leadTime = settings?.leadTimeMinutes ?? 60;
  const maxAdvance = settings?.maxAdvanceDays ?? 60;

  if (!hours || hours.closed) return [];

  // Per-stylist: capacity 1, and skip the stylist's day-off entirely.
  let capacity = settings?.capacity ?? 3;
  if (staffId) {
    const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { offDay: true } });
    capacity = 1;
    if (staff && offDayWeekday(staff.offDay) === dubaiWeekday(dateISO)) return [];
  }

  const dayStart = dubaiInstant(dateISO, hours.open);
  const dayEnd = dubaiInstant(dateISO, hours.close);
  const now = new Date();
  const earliest = addMinutes(now, leadTime);
  const horizon = addMinutes(now, maxAdvance * 24 * 60);

  // Pull bookings + blocks that could overlap this day (scoped to the stylist when set).
  const [bookings, blocks] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
        ...(staffId ? { staffId } : {}),
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.blockedSlot.findMany({
      where: { startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const openMin = hmToMinutes(hours.open);
  const closeMin = hmToMinutes(hours.close);
  const slots: Slot[] = [];

  for (let m = openMin; m + durationMin <= closeMin; m += slotMinutes) {
    const time = minutesToHm(m);
    const start = dubaiInstant(dateISO, time);
    const end = addMinutes(start, durationMin);

    if (start < earliest || start > horizon) continue;

    const blocked = blocks.some((b) => b.startAt < end && b.endAt > start);
    if (blocked) continue;

    const overlapping = bookings.filter((b) => b.startAt < end && b.endAt > start).length;
    if (overlapping >= capacity) continue;

    slots.push({ time, iso: start.toISOString() });
  }

  return slots;
}

/** Server-side re-validation used at booking time (guards against races). */
export async function isSlotBookable(
  startISO: string,
  durationMin: number,
  staffId?: string | null
): Promise<{ ok: boolean; reason?: string }> {
  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) return { ok: false, reason: "Invalid time" };

  const dateISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(start);

  const slots = await getAvailableSlots(dateISO, durationMin, staffId);
  const ok = slots.some((s) => s.iso === start.toISOString());
  return ok
    ? { ok }
    : { ok: false, reason: staffId ? "That artist isn't free then. Please pick another slot." : "That time was just taken. Please pick another slot." };
}
