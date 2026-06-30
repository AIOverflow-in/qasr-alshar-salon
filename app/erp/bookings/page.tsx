import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { aed } from "@/lib/utils";
import { dubaiDayRange } from "@/lib/finance";
import { TableSearch } from "@/components/erp/TableSearch";
import { BookingRow } from "@/components/admin/BookingRow";
import { NewBookingButton } from "@/components/erp/NewBookingButton";
import { BookingsFilters, type BookingCounts } from "@/components/erp/BookingsFilters";
import { CalendarSubscribe } from "@/components/erp/CalendarSubscribe";
import { calendarToken } from "@/lib/calendar";
import { SITE } from "@/lib/site";
import type { BookingStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function whenLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d);
}

const STATUS_MAP: Record<string, BookingStatus> = {
  confirmed: "CONFIRMED", completed: "COMPLETED", cancelled: "CANCELLED", noshow: "NO_SHOW",
};
const SOURCE_MAP: Record<string, string> = {
  online: "ONLINE", walkin: "WALKIN", phone: "PHONE", whatsapp: "WHATSAPP",
};

export default async function ErpBookings({
  searchParams,
}: {
  searchParams: Promise<{ when?: string; status?: string; source?: string }>;
}) {
  const session = await getSession();
  const isAdmin = session?.role === "SUPER_ADMIN" || session?.role === "ADMIN";

  const sp = await searchParams;
  const when = ["today", "tomorrow", "next2w", "all"].includes(sp.when ?? "") ? sp.when! : "today";
  const status = sp.status && STATUS_MAP[sp.status] ? sp.status : "all";
  const source = sp.source && SOURCE_MAP[sp.source] ? sp.source : "all";

  // Date window for the chosen "when"
  const today = dubaiDayRange(0);
  const tomorrow = dubaiDayRange(1);
  const next2wEnd = dubaiDayRange(13).end;
  const windowFor: Record<string, { gte: Date; lt: Date } | null> = {
    today: { gte: today.start, lt: today.end },
    tomorrow: { gte: tomorrow.start, lt: tomorrow.end },
    next2w: { gte: today.start, lt: next2wEnd },
    all: null,
  };

  const where: Prisma.BookingWhereInput = {
    ...(windowFor[when] ? { startAt: windowFor[when]! } : {}),
    ...(STATUS_MAP[status] ? { status: STATUS_MAP[status] } : {}),
    ...(SOURCE_MAP[source] ? { source: SOURCE_MAP[source] } : {}),
  };

  const [bookings, services, staff, clients, total, statusGroup, sourceGroup, cToday, cTomorrow, cNext2w] =
    await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { startAt: when === "all" ? "desc" : "asc" },
        take: 500,
        include: {
          staff: { select: { name: true, phone: true } },
          items: { select: { serviceId: true, serviceName: true, priceAED: true, durationMin: true } },
          createdBy: { select: { name: true } },
          salesOrders: { where: { status: "PAID" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, invoiceNo: true } },
        },
      }),
      prisma.service.findMany({ where: { active: true }, orderBy: { category: "asc" }, select: { id: true, name: true, category: true, priceAED: true } }),
      prisma.staff.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
      prisma.client.findMany({ orderBy: { updatedAt: "desc" }, take: 2000, select: { id: true, name: true, phone: true, email: true } }),
      prisma.booking.count(),
      prisma.booking.groupBy({ by: ["status"], _count: true }),
      prisma.booking.groupBy({ by: ["source"], _count: true }),
      prisma.booking.count({ where: { startAt: { gte: today.start, lt: today.end } } }),
      prisma.booking.count({ where: { startAt: { gte: tomorrow.start, lt: tomorrow.end } } }),
      prisma.booking.count({ where: { startAt: { gte: today.start, lt: next2wEnd } } }),
    ]);

  const statusCount = (s: BookingStatus) => statusGroup.find((g) => g.status === s)?._count ?? 0;
  const sourceCount = (s: string) => sourceGroup.find((g) => g.source === s)?._count ?? 0;

  const counts: BookingCounts = {
    when: { today: cToday, tomorrow: cTomorrow, next2w: cNext2w, all: total },
    status: {
      all: total,
      confirmed: statusCount("CONFIRMED"),
      completed: statusCount("COMPLETED"),
      cancelled: statusCount("CANCELLED"),
      noshow: statusCount("NO_SHOW"),
    },
    source: {
      all: total,
      online: sourceCount("ONLINE"),
      walkin: sourceCount("WALKIN"),
      phone: sourceCount("PHONE"),
      whatsapp: sourceCount("WHATSAPP"),
    },
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-cream">Bookings</h1>
          <p className="text-sm text-muted">Filter by day, status or source — update a status or generate a bill.</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarSubscribe url={`${SITE.url}/api/calendar?token=${calendarToken()}`} />
          <NewBookingButton services={services} staff={staff} clients={clients} />
        </div>
      </div>

      <BookingsFilters when={when} status={status} source={source} counts={counts} />

      {bookings.length === 0 ? (
        <div className="surface rounded-2xl p-10 text-center text-muted">No bookings match this filter.</div>
      ) : (
        <TableSearch placeholder="Search by client, phone, service or stylist…">
          <div className="surface overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-ink-line text-left text-muted">
                <tr>
                  <th className="p-4 font-medium">When</th>
                  <th className="p-4 font-medium">Client</th>
                  <th className="p-4 font-medium">Service</th>
                  <th className="p-4 font-medium">Source</th>
                  <th className="p-4 font-medium">Price</th>
                  <th className="p-4 font-medium">Status &amp; Bill</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line/60">
                {bookings.map((b) => {
                  const billed = !!b.salesOrders[0];
                  // Editable whenever it's not billed and not cancelled — staff stay in control,
                  // including after the slot time has passed (walk-ins).
                  const canEditServices = (b.status === "CONFIRMED" || b.status === "COMPLETED") && !billed;
                  return (
                    <BookingRow
                      key={b.id}
                      id={b.id}
                      when={whenLabel(b.startAt)}
                      startISO={b.startAt.toISOString()}
                      name={b.customerName}
                      phone={b.phone}
                      email={b.email}
                      service={b.serviceName}
                      price={aed(b.priceAED)}
                      notes={b.notes}
                      status={b.status}
                      source={b.source}
                      staffName={b.staff?.name ?? null}
                      serviceMode={b.serviceMode}
                      address={b.address}
                      customRequest={b.customRequest}
                      orderId={b.salesOrders[0]?.id ?? null}
                      invoiceNo={b.salesOrders[0]?.invoiceNo ?? null}
                      services={services}
                      currentServiceIds={b.items.map((it) => it.serviceId).filter((x): x is string => !!x)}
                      canEditServices={canEditServices}
                      canEditBill={isAdmin}
                      detail={{
                        items: b.items.map((it) => ({ serviceId: it.serviceId, name: it.serviceName, price: it.priceAED, duration: it.durationMin })),
                        staffPhone: b.staff?.phone ?? null,
                        enteredBy: b.createdBy?.name ?? null,
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </TableSearch>
      )}
    </div>
  );
}
