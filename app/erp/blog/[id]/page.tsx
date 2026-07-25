import { redirect, notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BlogEditor } from "@/components/admin/BlogEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit post — Qasr Alshar ERP" };

export default async function EditBlogPost({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole(["SUPER_ADMIN", "ADMIN"]))) redirect("/erp");
  const { id } = await params;
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) notFound();

  return (
    <BlogEditor
      post={{
        id: post.id,
        slug: post.slug,
        title: post.title,
        category: post.category,
        status: post.status,
        excerpt: post.excerpt,
        metaDescription: post.metaDescription,
        targetKeyword: post.targetKeyword ?? "",
        tags: post.tags,
        contentMarkdown: post.contentMarkdown,
        publishedAt: post.publishedAt.toISOString(),
      }}
    />
  );
}
