import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD (Dubai)
  const duration = Number(searchParams.get("duration") || "60");
  const staffId = searchParams.get("staffId") || undefined;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  try {
    const slots = await getAvailableSlots(date, duration, staffId);
    return NextResponse.json({ date, slots });
  } catch (e) {
    console.error("[availability]", e);
    return NextResponse.json({ error: "Failed to load availability" }, { status: 500 });
  }
}
