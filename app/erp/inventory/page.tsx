import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { InventoryActions } from "./InventoryActions";
import { InventoryTable } from "@/components/erp/InventoryTable";
import { parsePage, pageWindow } from "@/lib/pagination-core";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ErpInventory({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; category?: string }>;
}) {
  if (!(await requireRole(["SUPER_ADMIN", "ADMIN", "RECEPTION"]))) redirect("/erp");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const category = (sp.category ?? "").trim();
  const where: Prisma.ProductWhereInput = {
    active: true,
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
            { barcode: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // One page of the filtered set (server-side) — compute the window before the batch.
  const total = await prisma.product.count({ where });
  const win = pageWindow(total, parsePage(sp.page));

  const [products, grouped, lowRows] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ qty: "asc" }, { name: "asc" }],
      skip: win.skip,
      take: win.take,
      select: { id: true, name: true, category: true, barcode: true, qty: true, costAED: true, saleAED: true, reorderAt: true },
    }),
    prisma.product.groupBy({ by: ["category"], _count: true, where: { active: true }, orderBy: { category: "asc" } }),
    // Count against each product's own reorderAt (matches the per-row gold highlight), not a fixed 3.
    prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM "Product" WHERE "active" = true AND "qty" <= "reorderAt"`,
  ]);
  const lowCount = Number(lowRows[0]?.count ?? 0);

  const categories = grouped.map((g) => g.category);
  const totalActive = grouped.reduce((n, g) => n + g._count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-cream">Inventory</h1>
          <p className="text-sm text-muted">{totalActive} products · <span className="text-gold">{lowCount} low / out of stock</span></p>
        </div>
        <InventoryActions />
      </div>

      <InventoryTable products={products} categories={categories} category={category} total={win.total} page={win.page} size={win.size} />
    </div>
  );
}
