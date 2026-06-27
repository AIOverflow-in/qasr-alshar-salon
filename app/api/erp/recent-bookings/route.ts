import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Lightweight feed the ERP polls for new-booking notifications.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION", "STYLIST"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Only the last few hours matter for "new booking" toasts — keeps the polled query cheap.
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const bookings = await prisma.booking.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, customerName: true, serviceName: true, startAt: true, createdAt: true, serviceMode: true, source: true },
  });

  return NextResponse.json(
    {
      bookings: bookings.map((b) => ({
        id: b.id,
        customerName: b.customerName,
        serviceName: b.serviceName,
        startAt: b.startAt.toISOString(),
        createdAt: b.createdAt.toISOString(),
        serviceMode: b.serviceMode,
        source: b.source,
      })),
    },
    { headers: { "Cache-Control": "private, s-maxage=10, stale-while-revalidate=20" } }
  );
}
