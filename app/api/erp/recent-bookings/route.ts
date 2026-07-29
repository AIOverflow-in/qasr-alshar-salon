import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Lightweight feed the ERP polls for new-booking notifications.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Crown artists are calendar-only and must not see the whole salon's booking feed — exclude STYLIST.
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Only the last few hours matter for "new booking" toasts — keeps the polled query cheap.
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
  try {
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
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P1001" || error.code === "P1002"))
    ) {
      return NextResponse.json(
        { error: "Database temporarily unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } }
      );
    }
    throw error;
  }
}
