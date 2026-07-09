import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = ["jpg", "jpeg", "png", "webp", "gif", "avif", "pdf"];

/**
 * Upload an expense receipt / invoice image (or PDF) to Vercel Blob.
 * Allowed for managers AND reception (reception logs expenses add-only). Returns
 * the Blob URL + pathname (stored on Expense.receiptUrl / receiptPath).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["SUPER_ADMIN", "ADMIN", "RECEPTION"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Attach a receipt image or PDF." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 8 MB)." }, { status: 400 });
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED.includes(ext)) return NextResponse.json({ error: `Unsupported file type (.${ext}). Use a photo (JPG/PNG/WEBP) or PDF.` }, { status: 400 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Receipt storage not configured (BLOB_READ_WRITE_TOKEN missing)." }, { status: 500 });

  const safeName = (file.name || "receipt").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  try {
    const blob = await put(`expense-receipts/${safeName}`, file, { access: "public", addRandomSuffix: true });
    return NextResponse.json({ ok: true, url: blob.url, pathname: blob.pathname });
  } catch (e) {
    console.error("[expense-receipt] blob put failed:", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
