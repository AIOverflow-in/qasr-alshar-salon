import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { generateBlogPost } from "@/lib/openai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow if unset (dev)
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const token = url.searchParams.get("secret") || auth?.replace(/^Bearer\s+/i, "");
  return token === secret;
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only the public-facing deployment generates posts, so two projects sharing
  // one DB never double-post. ("all" = single combined deployment.)
  if ((process.env.DEPLOY_TARGET || "all") === "erp") {
    return NextResponse.json({ ok: true, skipped: "erp deployment does not generate blog posts" });
  }
  const post = await generateBlogPost();
  if (!post) {
    return NextResponse.json({ ok: false, error: "Generation failed" }, { status: 500 });
  }
  // refresh blog index, the new post, and sitemap
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/sitemap.xml");
  return NextResponse.json({ ok: true, slug: post.slug, title: post.title });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
