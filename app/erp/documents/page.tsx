import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CompanyDocuments } from "@/components/erp/CompanyDocuments";
import { Pagination } from "@/components/erp/Pagination";
import { parsePage, pageWindow } from "@/lib/pagination-core";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents — Qasr Alshar ERP" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  // Owner only — the most sensitive business documents (tax, agreements, licences).
  if (session.role !== "SUPER_ADMIN") redirect("/erp");

  const total = await prisma.companyDocument.count();
  const win = pageWindow(total, parsePage((await searchParams).page));
  const docs = await prisma.companyDocument.findMany({
    orderBy: { createdAt: "desc" },
    skip: win.skip,
    take: win.take,
    select: { id: true, title: true, description: true, category: true, fileName: true, sizeBytes: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Documents</h1>
        <p className="text-sm text-muted">Secure vault for tax filings, agreements, licences and other company records. Owner only — click a document to preview it in-app.</p>
      </div>
      <CompanyDocuments
        canEdit
        docs={docs.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
      />
      <Pagination total={win.total} page={win.page} size={win.size} />
    </div>
  );
}
