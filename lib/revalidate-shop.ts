import "server-only";
import { revalidateTag } from "next/cache";
import { SHOP_TAG } from "./shop";
import { SITE } from "./site";

/**
 * Purge the storefront cache everywhere after a product changes.
 *
 * The ERP and the public site are two separate Vercel projects with independent Data Caches, so
 * purging locally is not enough: without the cross-project call, a price edit made in the ERP stays
 * stale on the shop until the 5-minute TTL expires (measured: edit at 08:44, shop updated 08:50).
 *
 * Best-effort — a failed purge must never break saving a product; the TTL is still the backstop.
 */
export async function revalidateShopEverywhere(): Promise<void> {
  revalidateTag(SHOP_TAG, "max"); // this deployment

  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return; // not configured — the TTL still refreshes within 5 minutes
  const base = process.env.NEXT_PUBLIC_SITE_URL || SITE.url;
  try {
    await fetch(`${base.replace(/\/$/, "")}/api/revalidate-shop`, {
      method: "POST",
      headers: { "x-revalidate-secret": secret },
      cache: "no-store",
      signal: AbortSignal.timeout(4000), // never hold up the save
    });
  } catch (e) {
    console.error("[shop] cross-project revalidate failed (TTL will catch up):", e);
  }
}
