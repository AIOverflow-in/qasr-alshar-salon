import { NextResponse } from "next/server";
import { dispatchMessages } from "@/lib/message-engine/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  const token = new URL(req.url).searchParams.get("secret") || auth?.replace(/^Bearer\s+/i, "");
  return token === secret;
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await dispatchMessages());
  } catch (e) {
    console.error("[message-dispatch] failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "Message dispatcher failed." }, { status: 500 });
  }
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
