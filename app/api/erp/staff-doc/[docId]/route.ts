import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { inlineContentType } from "@/lib/file-preview-core";

export const dynamic = "force-dynamic";

// Auth-gated delivery of a staff document (SUPER_ADMIN / owner only — passport/visa/Emirates-ID
// scans are owner-eyes-only). We stream the blob rather than exposing its raw URL. Two modes:
//   • default: download-only attachment with a locked content type + nosniff.
//   • ?inline=1: images (non-SVG) and PDFs only, served inline with the real type + nosniff for
//     in-app preview. Anything else falls back to download, so an uploaded .html/.svg can never
//     execute as script on the ERP origin (stored-XSS defence).
export async function GET(req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { docId } = await params;
  const doc = await prisma.staffDocument.findUnique({ where: { id: docId }, select: { fileUrl: true } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const upstream = await fetch(doc.fileUrl);
  if (!upstream.ok) return NextResponse.json({ error: "File unavailable" }, { status: 502 });
  const buf = await upstream.arrayBuffer();

  const wantsInline = new URL(req.url).searchParams.get("inline") === "1";
  const inlineType = wantsInline ? inlineContentType(doc.fileUrl) : null;
  return new Response(buf, {
    headers: {
      "Content-Type": inlineType ?? "application/octet-stream",
      "Content-Disposition": inlineType ? "inline" : "attachment",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
