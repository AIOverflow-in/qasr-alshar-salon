import { prisma } from "@/lib/prisma";
import { aed } from "@/lib/utils";
import { BookingRow } from "@/components/admin/BookingRow";
import { TableSearch } from "@/components/erp/TableSearch";

export const dynamic = "force-dynamic";

function whenLabel(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export default async function AdminBookings({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const where = status && status !== "ALL" ? { status: status as never } : {};

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { startAt: "desc" },
    take: 200,
  });

  const filters = ["ALL", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-cream">Bookings</h1>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <a
            key={f}
            href={f === "ALL" ? "/admin/bookings" : `/admin/bookings?status=${f}`}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
              (status ?? "ALL") === f
                ? "border-gold bg-gold/15 text-gold"
                : "border-ink-line text-sand hover:border-gold/50"
            }`}
          >
            {f.replace("_", " ")}
          </a>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div className="surface rounded-2xl p-10 text-center text-muted">
          No bookings found.
        </div>
      ) : (
        <TableSearch placeholder="Search by client, phone, email or service…">
          <div className="surface overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[760px] text-sm">
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
