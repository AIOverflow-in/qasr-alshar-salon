import { NextResponse } from "next/server";
import { sendDailyDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail CLOSED in production: a missing secret must never leave the endpoint open.
  // In dev, allow without a secret for convenience.
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const token = url.searchParams.get("secret") || auth?.replace(/^Bearer\s+/i, "");
  return token === secret;
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Exactly one deployment sends the scheduled digest (two projects share one DB →
  // no double-send). The ERP-only deployment skips; the ERP "Send now" action calls
  // sendDailyDigest() directly, bypassing this gate.
  if ((process.env.DEPLOY_TARGET || "all") === "erp") {
    return NextResponse.json({ ok: true, skipped: "erp deployment does not send the digest" });
  }

  return NextResponse.json({ ok: true, ...(await sendDailyDigest()) });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
