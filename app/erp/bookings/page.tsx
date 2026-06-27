import { prisma } from "@/lib/prisma";
import { aed } from "@/lib/utils";
import { TableSearch } from "@/components/erp/TableSearch";
import { BookingRow } from "@/components/admin/BookingRow";
import { NewBookingButton } from "@/components/erp/NewBookingButton";

export const dynamic = "force-dynamic";

function whenLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d);
}

export default async function ErpBookings() {
  const [bookings, services, staff, clients] = await Promise.all([
    prisma.booking.findMany({
      orderBy: { startAt: "desc" },
      take: 300,
      include: {
        staff: { select: { name: true } },
        salesOrders: { where: { status: "PAID" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, invoiceNo: true } },
      },
    }),
    prisma.service.findMany({ where: { active: true }, orderBy: { category: "asc" }, select: { id: true, name: true, category: true, priceAED: true } }),
    prisma.staff.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    prisma.client.findMany({ orderBy: { updatedAt: "desc" }, take: 2000, select: { id: true, name: true, phone: true, email: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-cream">Bookings</h1>
          <p className="text-sm text-muted">Update a status or generate a bill — all in one place.</p>
        </div>
        <NewBookingButton services={services} staff={staff} clients={clients} />
      </div>

      {bookings.length === 0 ? (
        <div className="surface rounded-2xl p-10 text-center text-muted">No bookings yet.</div>
      ) : (
        <TableSearch placeholder="Search by client, phone, service or stylist…">
          <div className="surface overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-ink-line text-left text-muted">
                <tr>
                  <th className="p-4 font-medium">When</th>
                  <th className="p-4 font-medium">Client</th>
                  <th className="p-4 font-medium">Service</th>
                  <th className="p-4 font-medium">Price</th>
                  <th className="p-4 font-medium">Status &amp; Bill</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line/60">
                {bookings.map((b) => (
                  <BookingRow
                    key={b.id}
                    id={b.id}
                    when={whenLabel(b.startAt)}
                    name={b.customerName}
                    phone={b.phone}
                    email={b.email}
                    service={b.serviceName}
                    price={aed(b.priceAED)}
                    notes={b.notes}
                    status={b.status}
                    staffName={b.staff?.name ?? null}
                    serviceMode={b.serviceMode}
                    address={b.address}
                    customRequest={b.customRequest}
                    orderId={b.salesOrders[0]?.id ?? null}
                    invoiceNo={b.salesOrders[0]?.invoiceNo ?? null}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </TableSearch>
      )}
    </div>
  );
}
