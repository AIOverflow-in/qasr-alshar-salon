import { NextResponse } from "next/server";
import { runBackup } from "@/lib/backup/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Nightly database backup to Vercel Blob. Runs last in the cron window so it captures the day's
 * work after the other jobs have written theirs.
 *
 * Only the ERP deployment runs this: both Vercel projects are built from this repo and share one
 * database, so without the guard the backup would run twice every night.
 */
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization");
  const token = new URL(req.url).searchParams.get("secret") || header?.replace(/^Bearer\s+/i, "");
  return token === secret;
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.NODE_ENV === "production" && (process.env.DEPLOY_TARGET || "") !== "erp") {
    return NextResponse.json({ ok: true, skipped: "not-the-erp-deployment" });
  }
  try {
    const result = await runBackup();
    if (!result.ok) console.error("[backup] skipped:", result.skipped);
    else console.log(`[backup] ${result.key} — ${result.rows} rows, ${result.tables} tables, ${result.bytes} bytes, pruned ${result.pruned}`);
    return NextResponse.json(result);
  } catch (e) {
    // Loud on purpose: a backup that fails silently is the same as having no backup at all.
    console.error("[backup] FAILED:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Backup failed." }, { status: 500 });
  }
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
