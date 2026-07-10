import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TYPES = ["PASSPORT", "VISA", "LABOR_CARD", "EMIRATES_ID", "OTHER"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Upload a staff document to Vercel Blob (owner/SUPER_ADMIN only). Sensitive PII → stored with an
// unguessable URL and only ever served back through the auth-gated /api/erp/staff-doc/[id] route.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const staff = await prisma.staff.findUnique({ where: { id }, select: { id: true } });
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }
  const file = form.get("file");
  const type = String(form.get("type") || "OTHER");
  const expiryRaw = String(form.get("expiry") || "");

  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Attach a file." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 10 MB)." }, { status: 400 });
  if (!TYPES.includes(type)) return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Document storage not configured (BLOB_READ_WRITE_TOKEN missing)." }, { status: 500 });

  const safeName = (file.name || "document").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  let blob;
  try {
    blob = await put(`staff-docs/${id}/${type}-${safeName}`, file, { access: "public", addRandomSuffix: true });
  } catch (e) {
    console.error("[staff-docs] blob put failed:", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(expiryRaw) ? new Date(expiryRaw) : null;
  const doc = await prisma.staffDocument.create({ data: { staffId: id, type, fileUrl: blob.url, pathname: blob.pathname, expiry } });
  revalidatePath(`/erp/staff/${id}`);
  return NextResponse.json({ ok: true, id: doc.id });
}
