import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { SHOP_TAG } from "@/lib/shop";

export const dynamic = "force-dynamic";

/**
 * Purge the storefront cache from outside this deployment.
 *
 * WHY THIS EXISTS: the ERP (app.qasralsharsalon.com) and the public site (qasralsharsalon.com) are
 * two SEPARATE Vercel projects built from this one repo. Each has its own Data Cache, so a
 * revalidateTag() call inside the ERP can never purge the shop's cache — a price edit stayed stale
 * on the storefront until the 5-minute TTL expired. The ERP now calls this endpoint on the public
 * host after a product change, so the change is visible immediately.
 *
 * Protected by REVALIDATE_SECRET; without it set, the endpoint refuses everything (fails closed).
 */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const provided = req.headers.get("x-revalidate-secret") ?? new URL(req.url).searchParams.get("secret");
  if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  revalidateTag(SHOP_TAG, "max");
  return NextResponse.json({ ok: true, revalidated: SHOP_TAG });
}
