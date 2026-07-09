import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPaymentReminderEmail, NOTIFY_EMAILS } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail CLOSED in production; allow in dev without a secret for convenience.
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const token = url.searchParams.get("secret") || auth?.replace(/^Bearer\s+/i, "");
  return token === secret;
}

const DUBAI = "Asia/Dubai";
const DAY = 86_400_000;
const CAP = 40; // keep well under Resend's free daily allowance (shared across all mail)
const RENAG_MS = 7 * DAY; // overdue items are re-reminded at most weekly
const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: DUBAI, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(d);

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Exactly one deployment sends reminders (two projects share one DB) — mirror the digest cron.
  if ((process.env.DEPLOY_TARGET || "all") === "erp") {
    return NextResponse.json({ ok: true, skipped: "erp deployment does not send reminders" });
  }

  const now = new Date();
  // Bounded fetch: any pending payment due within the next 90 days, or already overdue.
  const horizon = new Date(now.getTime() + 90 * DAY);
  const pending = await prisma.scheduledPayment.findMany({
    where: { status: "PENDING", dueDate: { lte: horizon } },
    orderBy: { dueDate: "asc" },
  });

  // Midday-anchored day difference so labels don't drift at the timezone edge.
  const dayStr = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: DUBAI, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const daysUntil = (due: Date) => Math.round((Date.parse(dayStr(due) + "T12:00:00") - Date.parse(dayStr(now) + "T12:00:00")) / DAY);

  const due = pending.filter((p) => {
    const d = daysUntil(p.dueDate);
    if (d > p.remindDaysBefore) return false; // not inside its lead window yet
    // Dedupe: skip if we already reminded and it's not yet time to re-nag an overdue one.
    if (p.reminderSentAt && now.getTime() - p.reminderSentAt.getTime() < RENAG_MS) return false;
    return true;
  }).slice(0, CAP);

  if (!due.length) return NextResponse.json({ ok: true, sent: false, due: 0 });

  const recipients = NOTIFY_EMAILS;

  const sent = await sendPaymentReminderEmail(recipients, due.map((p) => ({
    label: p.label, amountAED: p.amountAED, dueLabel: fmtDate(p.dueDate), daysUntil: daysUntil(p.dueDate),
    payee: p.payee, reference: p.reference, method: p.method,
  })));

  if (sent) {
    await prisma.scheduledPayment.updateMany({ where: { id: { in: due.map((p) => p.id) } }, data: { reminderSentAt: now } });
  }

  return NextResponse.json({ ok: true, sent, due: due.length, overdue: due.filter((p) => daysUntil(p.dueDate) < 0).length });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
