import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { GenerateButton, PostActions } from "@/components/admin/BlogManager";
import { TableSearch } from "@/components/erp/TableSearch";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blog — Qasr Alshar ERP" };

function fmt(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "numeric", month: "short", year: "numeric" }).format(d);
}

export default async function ErpBlog() {
  const ok = await requireRole(["SUPER_ADMIN", "ADMIN"]);
  if (!ok) redirect("/erp");

  const [posts, topicsLeft] = await Promise.all([
    prisma.blogPost.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.blogTopic.count({ where: { used: false } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-cream">Blog</h1>
          <p className="text-sm text-muted">Auto-publishes every alternate day · {topicsLeft} fresh topics queued</p>
        </div>
        <GenerateButton />
      </div>

      {posts.length === 0 ? (
        <div className="surface rounded-2xl p-10 text-center text-muted">
          No posts yet. Click “Generate now” to create your first AI article.
        </div>
      ) : (
        <TableSearch placeholder="Search posts by title or category…">
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
                      <Link href={`/blog/${p.slug}`} target="_blank" className="text-cream hover:text-gold">{p.title}</Link>
                    </td>
                    <td className="p-4 text-sand">{p.category}</td>
                    <td className="p-4 text-muted">{fmt(p.publishedAt)}</td>
                    <td className="p-4 text-muted">{p.source}</td>
                    <td className="p-4">
                      <span className={`rounded-full border px-2.5 py-1 text-xs ${p.status === "PUBLISHED" ? "border-green-500/40 text-green-400" : "border-muted/40 text-muted"}`}>
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
        </TableSearch>
      )}
    </div>
  );
}
