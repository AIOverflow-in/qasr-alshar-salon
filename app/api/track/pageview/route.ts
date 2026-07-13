import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeTrack } from "@/lib/web-analytics-core";

export const dynamic = "force-dynamic";

/** Current Dubai calendar day as "YYYY-MM-DD". */
function dubaiDay(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Public page beacon. Called once per public page visit (navigator.sendBeacon on
// page hide) with { path, sec }. Upserts a bounded daily rollup row. Always
// returns 204 quickly and never throws — analytics must never affect a page.
export async function POST(req: Request) {
  let body: unknown;
  try { body = JSON.parse(await req.text()); } catch { return new NextResponse(null, { status: 204 }); }

  const b = (body ?? {}) as Record<string, unknown>;
  const hit = normalizeTrack(b.path, b.sec);
  if (!hit) return new NextResponse(null, { status: 204 }); // ignore junk quietly

  try {
    const day = dubaiDay();
    await prisma.pageStat.upsert({
      where: { day_path: { day, path: hit.path } },
      update: { views: { increment: 1 }, engagedSec: { increment: hit.sec } },
      create: { day, path: hit.path, views: 1, engagedSec: hit.sec },
    });
  } catch (e) {
    console.error("[track] pageview upsert failed:", e);
  }
  return new NextResponse(null, { status: 204 });
}
