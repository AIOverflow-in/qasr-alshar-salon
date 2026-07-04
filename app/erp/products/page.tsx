import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { CatalogManager } from "@/components/erp/CatalogManager";

export const dynamic = "force-dynamic";

export default async function ErpProducts() {
  if (!(await requireRole(["SUPER_ADMIN", "ADMIN"]))) redirect("/erp");

  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ retail: "desc" }, { name: "asc" }],
    take: 500,
    select: { id: true, name: true, category: true, saleAED: true, qty: true, retail: true, description: true, imageUrl: true, active: true },
  });
  const published = products.filter((p) => p.retail && (p.saleAED ?? 0) > 0 && p.imageUrl && p.qty > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Storefront</h1>
        <p className="text-sm text-muted">
          Manage the products customers can buy online. <span className="text-sand">{published}</span> live on the shop
          {" "}· a product appears once it has a price, an image, stock, and is Published.
        </p>
      </div>
      <CatalogManager products={products} />
    </div>
  );
}
