import { NextResponse } from "next/server";
import { harvestKeywords } from "@/lib/keywords";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail CLOSED in production: a missing secret must never leave this open
  // (it triggers paid web-search + model calls). Dev allows without a secret.
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const token = url.searchParams.get("secret") || auth?.replace(/^Bearer\s+/i, "");
  return token === secret;
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only the public-facing deployment harvests, so two projects sharing one DB
  // never double-harvest. ("all" = single combined deployment.)
  if ((process.env.DEPLOY_TARGET || "all") === "erp") {
    return NextResponse.json({ ok: true, skipped: "erp deployment does not harvest keywords" });
  }
  const result = await harvestKeywords();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
