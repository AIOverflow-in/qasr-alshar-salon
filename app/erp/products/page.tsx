import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { CatalogManager } from "@/components/erp/CatalogManager";
import { Pagination } from "@/components/erp/Pagination";
import { parsePage, pageWindow } from "@/lib/pagination-core";
import { ProductSearch } from "@/components/erp/ProductSearch";
import { BulkPriceEditor } from "@/components/erp/BulkPriceEditor";

export const dynamic = "force-dynamic";

export default async function ErpProducts({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  if (!(await requireRole(["SUPER_ADMIN", "ADMIN"]))) redirect("/erp");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  // Search runs in the DB so it covers the whole catalogue, not just the page being viewed.
  const where = {
    active: true,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { category: { contains: q, mode: "insensitive" as const } },
            { barcode: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const total = await prisma.product.count({ where });
  const win = pageWindow(total, parsePage(sp.page));
  const products = await prisma.product.findMany({
    where,
    orderBy: [{ retail: "desc" }, { name: "asc" }],
    skip: win.skip,
    take: win.take,
    select: { id: true, name: true, category: true, saleAED: true, qty: true, retail: true, description: true, imageUrl: true, active: true },
  });
  // "Live on the shop" is a store-wide figure — count across ALL products, not just this page.
  const published = await prisma.product.count({
    where: { active: true, retail: true, saleAED: { gt: 0 }, imageUrl: { not: null }, qty: { gt: 0 } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Storefront</h1>
        <p className="text-sm text-muted">
          Manage the products customers can buy online. <span className="text-sand">{published}</span> live on the shop
          {" "}· a product appears once it has a price, an image, stock, and is Published.
        </p>
      </div>
      <ProductSearch initial={q} total={total} />
      <BulkPriceEditor products={products.map((p) => ({ id: p.id, name: p.name, category: p.category, saleAED: p.saleAED }))} />
      <CatalogManager products={products} />
      <Pagination total={win.total} page={win.page} size={win.size} />
    </div>
  );
}
