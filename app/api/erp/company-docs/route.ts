import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CATEGORIES = ["TAX", "LICENSE", "LEASE", "INSURANCE", "FINANCE", "HR", "OTHER"];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
// Allow-list document/image types (defence-in-depth; files are also served download-only + nosniff).
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "webp", "gif", "heic", "doc", "docx", "xls", "xlsx", "csv", "txt", "ppt", "pptx"];

/** Upload a company document to Vercel Blob (admins only). Served only via the gated serve route. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }
  const file = form.get("file");
  const title = String(form.get("title") || "").trim();
  const description = String(form.get("description") || "").trim();
  const category = String(form.get("category") || "OTHER");

  if (!title) return NextResponse.json({ error: "Add a title." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Attach a file." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 20 MB)." }, { status: 400 });
  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return NextResponse.json({ error: `Unsupported file type (.${ext}). Allowed: ${ALLOWED_EXT.join(", ")}.` }, { status: 400 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Document storage not configured (BLOB_READ_WRITE_TOKEN missing)." }, { status: 500 });

  const safeName = (file.name || "document").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  let blob;
  try {
    blob = await put(`company-docs/${category}/${safeName}`, file, { access: "public", addRandomSuffix: true });
  } catch (e) {
    console.error("[company-docs] blob put failed:", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  await prisma.companyDocument.create({
    data: {
      title, description: description || null, category: category as (typeof CATEGORIES)[number] as never,
      fileUrl: blob.url, pathname: blob.pathname, fileName: file.name.slice(0, 200), sizeBytes: file.size, uploadedById: session.sub,
    },
  });
  revalidatePath("/erp/documents");
  return NextResponse.json({ ok: true });
}
