import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function isAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

// Auth-gated download of a company document (admins only). Streamed as an attachment with a locked
// content type + nosniff so an uploaded .html/.svg can never execute as script on the ERP origin.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const doc = await prisma.companyDocument.findUnique({ where: { id }, select: { fileUrl: true, fileName: true } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const upstream = await fetch(doc.fileUrl);
  if (!upstream.ok) return NextResponse.json({ error: "File unavailable" }, { status: 502 });
  const buf = await upstream.arrayBuffer();
  const name = (doc.fileName || "document").replace(/[^a-zA-Z0-9._ -]/g, "_");
  return new Response(buf, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

// Delete a company document (admins only) — removes the blob and the record.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const doc = await prisma.companyDocument.findUnique({ where: { id }, select: { fileUrl: true } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try { if (process.env.BLOB_READ_WRITE_TOKEN) await del(doc.fileUrl); } catch (e) { console.error("[company-doc] blob del failed:", e); }
  await prisma.companyDocument.delete({ where: { id } });
  revalidatePath("/erp/documents");
  return NextResponse.json({ ok: true });
}
