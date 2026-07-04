import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CompanyDocuments } from "@/components/erp/CompanyDocuments";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents — Qasr Alshar ERP" };

export default async function DocumentsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  // Admins only — sensitive business documents (tax, agreements, licences).
  if (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN") redirect("/erp");

  const docs = await prisma.companyDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, title: true, description: true, category: true, fileName: true, sizeBytes: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Documents</h1>
        <p className="text-sm text-muted">Secure vault for tax filings, agreements, licences and other company records. Admins only.</p>
      </div>
      <CompanyDocuments
        canEdit
        docs={docs.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
      />
    </div>
  );
}
