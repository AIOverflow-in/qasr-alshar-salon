import { prisma } from "@/lib/prisma";
import { HoursManager } from "@/components/admin/HoursManager";

export const dynamic = "force-dynamic";

export default async function AdminHours() {
  const [hours, settings, blocks] = await Promise.all([
    prisma.workingHours.findMany({ orderBy: { weekday: "asc" } }),
    prisma.salonSettings.findUnique({ where: { id: "singleton" } }),
    prisma.blockedSlot.findMany({ orderBy: { startAt: "asc" }, take: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Hours & Settings</h1>
        <p className="text-sm text-muted">
          Control opening hours, capacity, and blocked dates that drive online availability.
        </p>
      </div>

      <HoursManager
        hours={hours.map((h) => ({ weekday: h.weekday, open: h.open, close: h.close, closed: h.closed }))}
        settings={{
          capacity: settings?.capacity ?? 3,
          slotMinutes: settings?.slotMinutes ?? 30,
          leadTimeMinutes: settings?.leadTimeMinutes ?? 60,
          maxAdvanceDays: settings?.maxAdvanceDays ?? 60,
        }}
        blocks={blocks.map((b) => ({
          id: b.id,
          startAt: b.startAt.toISOString(),
          endAt: b.endAt.toISOString(),
          reason: b.reason,
        }))}
      />
    </div>
  );
}
