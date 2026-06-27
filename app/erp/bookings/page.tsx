import { prisma } from "@/lib/prisma";
import { aed } from "@/lib/utils";
import { TableSearch } from "@/components/erp/TableSearch";
import { BookingRow } from "@/components/admin/BookingRow";

export const dynamic = "force-dynamic";

function whenLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d);
}

export default async function ErpBookings() {
  const bookings = await prisma.booking.findMany({
    orderBy: { startAt: "desc" },
    take: 300,
    include: {
      staff: { select: { name: true } },
      salesOrders: { where: { status: "PAID" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, invoiceNo: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Bookings</h1>
        <p className="text-sm text-muted">Update a status or generate a bill — all in one place.</p>
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
