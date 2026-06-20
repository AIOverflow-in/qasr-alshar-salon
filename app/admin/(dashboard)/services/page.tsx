import { prisma } from "@/lib/prisma";
import { ServiceEditRow } from "@/components/admin/ServiceEditRow";

export const dynamic = "force-dynamic";

export default async function AdminServices() {
  const services = await prisma.service.findMany({ orderBy: { order: "asc" } });

  const groups = new Map<string, typeof services>();
  for (const s of services) {
    if (!groups.has(s.category)) groups.set(s.category, []);
    groups.get(s.category)!.push(s);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Services</h1>
        <p className="text-sm text-muted">
          Update prices, durations, and visibility. Changes appear on the site instantly.
        </p>
      </div>

      <div className="space-y-8">
        {[...groups.entries()].map(([cat, items]) => (
          <div key={cat} className="surface overflow-hidden rounded-2xl">
            <div className="border-b border-ink-line px-5 py-3 font-display text-lg text-gold">
              {cat}
            </div>
            <div className="divide-y divide-ink-line/60">
              {items.map((s) => (
                <ServiceEditRow
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  priceAED={s.priceAED}
                  durationMin={s.durationMin}
                  active={s.active}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
