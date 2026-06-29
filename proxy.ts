import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * DEPLOY_TARGET controls what this deployment serves:
 *   "all"    → everything (default — the single combined deployment, current behaviour)
 *   "public" → marketing site only; /admin, /erp, /api/erp bounce to the app URL
 *   "erp"    → back-office only; marketing routes bounce to the public site
 * Sharing one database, this lets the public site and the ERP run as two
 * independent Vercel projects from the same repo.
 */
const TARGET = process.env.DEPLOY_TARGET || "all";

const APP_PREFIXES = ["/admin", "/erp", "/api/erp"];
const MARKETING_PREFIXES = ["/services", "/gallery", "/henna", "/packages", "/about", "/contact", "/blog", "/book", "/terms"];

const startsWithAny = (p: string, prefixes: string[]) =>
  prefixes.some((x) => p === x || p.startsWith(x + "/"));

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  // Public deployment: the back-office doesn't live here.
  if (TARGET === "public" && startsWithAny(pathname, APP_PREFIXES)) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    return appUrl
      ? NextResponse.redirect(new URL(pathname, appUrl))
      : new NextResponse("Not found", { status: 404 });
  }

  // App deployment: marketing pages live on the public site.
  if (TARGET === "erp") {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl) {
      if (pathname === "/") return NextResponse.redirect(new URL("/admin/login", request.url));
      if (startsWithAny(pathname, MARKETING_PREFIXES)) return NextResponse.redirect(new URL(pathname, siteUrl));
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
