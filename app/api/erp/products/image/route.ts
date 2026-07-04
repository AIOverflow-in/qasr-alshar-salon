import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["jpg", "jpeg", "png", "webp", "gif", "avif"];

/**
 * Upload a storefront product image to Vercel Blob (admins only) and return its public URL.
 * Product images are meant to be public (shown on the shop), so the URL is used directly as
 * Product.imageUrl — no gated serve needed (unlike private staff/company documents).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Attach an image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image too large (max 5 MB)." }, { status: 400 });
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED.includes(ext)) return NextResponse.json({ error: `Unsupported image type (.${ext}). Use JPG, PNG, WEBP, GIF or AVIF.` }, { status: 400 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Image storage not configured (BLOB_READ_WRITE_TOKEN missing)." }, { status: 500 });

  const safeName = (file.name || "image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  try {
    const blob = await put(`product-images/${safeName}`, file, { access: "public", addRandomSuffix: true });
    return NextResponse.json({ ok: true, url: blob.url });
  } catch (e) {
    console.error("[product-image] blob put failed:", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
