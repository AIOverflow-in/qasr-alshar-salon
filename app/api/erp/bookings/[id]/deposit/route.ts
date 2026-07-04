import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  // Set/adjust the deposit amount requested (0 clears it). Omit to leave unchanged.
  depositAED: z.number().int().nonnegative().max(1_000_000).optional(),
  // Mark the deposit received (true → stamps now) or not-yet-received (false → clears). Omit to leave unchanged.
  paid: z.boolean().optional(),
});

/**
 * Reception/admin control over a booking's deposit: adjust the requested amount and mark
 * it received once the bank transfer lands. Kept separate from the booking editor so it
 * stays usable regardless of the booking's billed/cancelled state.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid deposit update." }, { status: 400 });
  const d = parsed.data;
  if (d.depositAED === undefined && d.paid === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id }, select: { id: true } });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  try {
    const updated = await prisma.booking.update({
      where: { id },
      data: {
        ...(d.depositAED !== undefined ? { depositAED: d.depositAED } : {}),
        ...(d.paid !== undefined ? { depositPaidAt: d.paid ? new Date() : null } : {}),
      },
      select: { depositAED: true, depositPaidAt: true },
    });
    revalidatePath("/erp/bookings");
    revalidatePath("/erp");
    return NextResponse.json({ ok: true, depositAED: updated.depositAED, depositPaidAt: updated.depositPaidAt });
  } catch (e) {
    console.error("[erp/bookings/deposit] failed:", e);
    return NextResponse.json({ error: "Could not update the deposit. Please try again." }, { status: 500 });
  }
}
