import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dubaiDayRange } from "@/lib/finance";
import { sendFeedbackEmail, sendRebookEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Resend free tier is 100 emails/day shared across ALL mail — cap each kind so follow-ups can never
// blow the budget. Volume is small in practice; the cap is just a backstop.
const CAP = 40;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // fail-closed in prod
  const auth = req.headers.get("authorization");
  const token = new URL(req.url).searchParams.get("secret") || auth?.replace(/^Bearer\s+/i, "");
  return token === secret;
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Exactly one deployment sends (two projects share one DB → no double-send), mirroring the other crons.
  if ((process.env.DEPLOY_TARGET || "all") === "erp") {
    return NextResponse.json({ ok: true, skipped: "erp deployment does not send follow-ups" });
  }

  // 1) Feedback: services completed yesterday (Dubai), with an email, not yet thanked.
  const y = dubaiDayRange(-1);
  const feedbackDue = await prisma.booking.findMany({
    where: { status: "COMPLETED", endAt: { gte: y.start, lt: y.end }, email: { not: "" }, feedbackSentAt: null },
    take: CAP,
    select: { id: true, email: true, customerName: true, serviceName: true },
  });
  let feedbackSent = 0;
  for (const b of feedbackDue) {
    if (await sendFeedbackEmail(b.email, { customerName: b.customerName, serviceName: b.serviceName })) {
      await prisma.booking.update({ where: { id: b.id }, data: { feedbackSentAt: new Date() } });
      feedbackSent++;
    }
  }

  // 2) Rebook: completed ~28–30 days ago, with an email, not yet nudged, and no later booking since.
  const now = Date.now();
  const rebookDue = await prisma.booking.findMany({
    where: { status: "COMPLETED", endAt: { gte: new Date(now - 30 * 864e5), lt: new Date(now - 28 * 864e5) }, email: { not: "" }, rebookSentAt: null },
    take: CAP,
    select: { id: true, email: true, customerName: true, serviceName: true, clientId: true, endAt: true },
  });
  let rebookSent = 0;
  for (const b of rebookDue) {
    // If they've genuinely booked again since (a live/kept booking, not a cancelled/no-show one),
    // mark done and skip the nudge.
    if (b.clientId) {
      const newer = await prisma.booking.findFirst({ where: { clientId: b.clientId, startAt: { gt: b.endAt }, status: { in: ["CONFIRMED", "COMPLETED"] } }, select: { id: true } });
      if (newer) { await prisma.booking.update({ where: { id: b.id }, data: { rebookSentAt: new Date() } }); continue; }
    }
    if (await sendRebookEmail(b.email, { customerName: b.customerName, serviceName: b.serviceName })) {
      await prisma.booking.update({ where: { id: b.id }, data: { rebookSentAt: new Date() } });
      rebookSent++;
    }
  }

  const capped = feedbackDue.length >= CAP || rebookDue.length >= CAP;
  if (capped) console.warn("[client-followups] hit the per-run cap; remaining will send tomorrow.");
  return NextResponse.json({ ok: true, feedbackSent, rebookSent, capped });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
