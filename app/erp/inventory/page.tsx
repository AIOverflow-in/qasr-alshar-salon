import { prisma } from "@/lib/prisma";
import { InventoryActions } from "./InventoryActions";
import { InventoryTable } from "@/components/erp/InventoryTable";

export const dynamic = "force-dynamic";

export default async function ErpInventory() {
  const [products, grouped, lowCount] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ qty: "asc" }, { name: "asc" }],
      take: 2000,
      select: { id: true, name: true, category: true, barcode: true, qty: true, costAED: true, saleAED: true, reorderAt: true },
    }),
    prisma.product.groupBy({ by: ["category"], _count: true, where: { active: true }, orderBy: { category: "asc" } }),
    prisma.product.count({ where: { active: true, qty: { lte: 3 } } }),
  ]);

  const categories = grouped.map((g) => g.category);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-cream">Inventory</h1>
          <p className="text-sm text-muted">{products.length} products · <span className="text-gold">{lowCount} low / out of stock</span></p>
        </div>
        <InventoryActions />
      </div>

      <InventoryTable products={products} categories={categories} />
    </div>
  );
}
