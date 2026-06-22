import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ErpProducts() {
  const retail = await prisma.product.count({ where: { retail: true, active: true } });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-cream">Storefront (Aftercare)</h1>
      <div className="surface rounded-2xl p-6 text-sm text-muted">
        <p className="text-cream">{retail} retail / aftercare products ready to sell online.</p>
        <p className="mt-2">
          The e-commerce slice turns these into a customer storefront with <span className="text-sand">hair-type / service-based recommendations</span>
          (e.g. low-porosity), cart, and checkout — sharing this inventory so stock stays in sync.
        </p>
      </div>
    </div>
  );
}
