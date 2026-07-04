import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Auth-gated delivery of a staff document (managers only). We stream the blob rather than exposing
// its raw URL, so passport/ID scans are never reachable without a manager session.
export async function GET(_req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { docId } = await params;
  const doc = await prisma.staffDocument.findUnique({ where: { id: docId }, select: { fileUrl: true } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const upstream = await fetch(doc.fileUrl);
  if (!upstream.ok) return NextResponse.json({ error: "File unavailable" }, { status: 502 });
  const buf = await upstream.arrayBuffer();
  // Serve as a download with a locked content type + nosniff so an uploaded .html/.svg can never
  // execute as script on the ERP origin (stored-XSS defence — the type is never sniffed/rendered inline).
  return new Response(buf, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": "attachment",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
