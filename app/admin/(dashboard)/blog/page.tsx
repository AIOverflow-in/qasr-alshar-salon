import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { GenerateButton, PostActions } from "@/components/admin/BlogManager";
import { SearchBox } from "@/components/erp/SearchBox";
import { Pagination } from "@/components/erp/Pagination";
import { parsePage, pageWindow } from "@/lib/pagination-core";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default async function AdminBlog({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  if (!(await requireRole(["SUPER_ADMIN", "ADMIN"]))) redirect("/erp");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const where: Prisma.BlogPostWhereInput = q
    ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }] }
    : {};

  const total = await prisma.blogPost.count({ where });
  const win = pageWindow(total, parsePage(sp.page));
  const [posts, topicsLeft] = await Promise.all([
    prisma.blogPost.findMany({ where, orderBy: { createdAt: "desc" }, skip: win.skip, take: win.take }),
    prisma.blogTopic.count({ where: { used: false } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-cream">Blog</h1>
          <p className="text-sm text-muted">
            Auto-publishes every alternate day · {topicsLeft} fresh topics queued
          </p>
        </div>
        <GenerateButton />
      </div>

      <SearchBox placeholder="Search posts by title or category…" className="max-w-sm" />

      {total === 0 ? (
        <div className="surface rounded-2xl p-10 text-center text-muted">
          {q ? `No posts match “${q}”.` : "No posts yet. Click “Generate now” to create your first AI article."}
        </div>
      ) : (
        <>
          <div className="surface overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="border-b border-ink-line text-left text-muted">
                <tr>
                  <th className="p-4 font-medium">Title</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Source</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line/60">
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td className="max-w-xs p-4">
                      <Link href={`/blog/${p.slug}`} target="_blank" className="text-cream hover:text-gold">
                        {p.title}
                      </Link>
                    </td>
                    <td className="p-4 text-sand">{p.category}</td>
                    <td className="p-4 text-muted">{fmt(p.publishedAt)}</td>
                    <td className="p-4 text-muted">{p.source}</td>
                    <td className="p-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs ${
                          p.status === "PUBLISHED"
                            ? "border-green-500/40 text-green-400"
                            : "border-muted/40 text-muted"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <PostActions id={p.id} published={p.status === "PUBLISHED"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={win.total} page={win.page} size={win.size} />
        </>
      )}
    </div>
  );
}
