import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { InventoryActions } from "./InventoryActions";

export const dynamic = "force-dynamic";

export default async function ErpInventory({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; low?: string }>;
}) {
  const { q, cat, low } = await searchParams;

  const where: Prisma.ProductWhereInput = { active: true };
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { barcode: { contains: q } }];
  if (cat) where.category = cat;
  if (low === "1") where.qty = { lte: 3 };

  const [products, categories, total, lowCount] = await Promise.all([
    prisma.product.findMany({ where, orderBy: [{ qty: "asc" }, { name: "asc" }], take: 300 }),
    prisma.product.groupBy({ by: ["category"], _count: true, orderBy: { category: "asc" } }),
    prisma.product.count({ where: { active: true } }),
    prisma.product.count({ where: { active: true, qty: { lte: 3 } } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-cream">Inventory</h1>
          <p className="text-sm text-muted">{total} products · <span className="text-gold">{lowCount} low / out of stock</span></p>
        </div>
        <InventoryActions />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form className="flex gap-2" action="/erp/inventory">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name or barcode…"
            className="rounded-full border border-ink-line bg-ink-card px-4 py-2 text-sm text-cream outline-none placeholder:text-muted focus:border-gold/60"
          />
          <button className="rounded-full bg-gold-gradient px-4 py-2 text-sm font-semibold text-espresso">Search</button>
        </form>
        <Link href="/erp/inventory?low=1" className={`rounded-full border px-3 py-1.5 text-xs ${low === "1" ? "border-gold bg-gold/15 text-gold" : "border-red-500/40 text-red-400 hover:border-red-400"}`}>
          Low stock ({lowCount})
        </Link>
      </div>

      {/* category chips */}
      <div className="flex flex-wrap gap-2">
        <Link href="/erp/inventory" className={`rounded-full border px-3 py-1.5 text-xs ${!cat && !low ? "border-gold bg-gold/15 text-gold" : "border-ink-line text-sand hover:border-gold/50"}`}>
          All ({total})
        </Link>
        {categories.map((c) => (
          <Link
            key={c.category}
            href={`/erp/inventory?cat=${encodeURIComponent(c.category)}`}
            className={`rounded-full border px-3 py-1.5 text-xs ${cat === c.category ? "border-gold bg-gold/15 text-gold" : "border-ink-line text-sand hover:border-gold/50"}`}
          >
            {c.category} ({c._count})
          </Link>
        ))}
      </div>

      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-ink-line text-left text-muted">
            <tr>
              <th className="p-3 font-medium">Product</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">Barcode</th>
              <th className="p-3 font-medium text-right">Qty</th>
              <th className="p-3 font-medium text-right">Sale AED</th>
              <th className="p-3 font-medium text-center">Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line/60">
            {products.map((p) => (
              <tr key={p.id} className={p.qty === 0 ? "bg-red-500/5" : ""}>
                <td className="p-3 text-cream">{p.name}</td>
                <td className="p-3 text-xs text-muted">{p.category}</td>
                <td className="p-3 font-mono text-xs text-muted">{p.barcode ?? "—"}</td>
                <td className="p-3 text-right">
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${p.qty === 0 ? "border-red-500/40 text-red-400" : p.qty <= 3 ? "border-gold/40 text-gold" : "border-ink-line text-sand"}`}>
                    {p.qty}
                  </span>
                </td>
                <td className="p-3 text-right text-sand">{p.saleAED ? `${p.saleAED}` : "—"}</td>
                <td className="p-3 text-center">
                  <InventoryAdjustInline productId={p.id} productName={p.name} currentQty={p.qty} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryAdjustInline({ productId, productName, currentQty }: { productId: string; productName: string; currentQty: number }) {
  // Rendered server-side; actual interactivity is in InventoryActions client component
  return (
    <div className="flex items-center justify-center gap-1 text-xs text-muted">
      <span className="font-mono">{currentQty}</span>
    </div>
  );
}
