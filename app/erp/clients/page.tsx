import { prisma } from "@/lib/prisma";
import { aed } from "@/lib/utils";
import { Users, PlusCircle } from "lucide-react";
import { ClientsManager } from "./ClientsManager";

export const dynamic = "force-dynamic";

export default async function ErpClients({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const clients = await prisma.client.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      salesOrders: {
        where: { status: "PAID" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { invoiceNo: true, totalAED: true, createdAt: true },
      },
    },
  });

  const total = await prisma.client.count();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-cream">Clients</h1>
          <p className="text-sm text-muted">{total} clients in CRM</p>
        </div>
        <ClientsManager />
      </div>

      <form className="flex gap-2" action="/erp/clients">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name, phone or email…"
          className="flex-1 rounded-full border border-ink-line bg-ink-card px-4 py-2.5 text-sm text-cream outline-none placeholder:text-muted focus:border-gold/60"
        />
        <button className="rounded-full bg-gold-gradient px-5 py-2.5 text-sm font-semibold text-espresso">Search</button>
      </form>

      {clients.length === 0 ? (
        <div className="surface rounded-2xl p-10 text-center">
          <Users className="mx-auto text-gold" size={32} />
          <p className="mt-3 text-cream">{q ? `No clients found for "${q}"` : "No client records yet."}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Clients are auto-created from POS sales. Click &ldquo;Add Client&rdquo; to create a walk-in record manually.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => (
            <div key={c.id} className="surface rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-cream">{c.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted">
                    {c.phone && <span>{c.phone}</span>}
                    {c.email && <span>{c.email}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-gold">{c.visits}</div>
                    <div className="text-xs text-muted">visits</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gold">{aed(c.totalSpentAED)}</div>
                    <div className="text-xs text-muted">spent</div>
                  </div>
                </div>
              </div>

              {(c.hairType || c.notes) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.hairType && (
                    <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-0.5 text-xs text-gold">
                      {c.hairType}
                    </span>
                  )}
                  {c.notes && (
                    <span className="text-xs text-muted italic">{c.notes}</span>
                  )}
                </div>
              )}

              {c.salesOrders.length > 0 && (
                <div className="mt-3 border-t border-ink-line/50 pt-3">
                  <div className="text-xs text-muted mb-1.5">Recent orders</div>
                  <div className="flex flex-wrap gap-2">
                    {c.salesOrders.map((o) => (
                      <span key={o.invoiceNo} className="text-xs text-sand">
                        {o.invoiceNo} · {aed(o.totalAED)} ·{" "}
                        {new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "short", timeZone: "Asia/Dubai" }).format(o.createdAt)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 flex justify-end">
                <ClientsManager editClient={{ id: c.id, name: c.name, phone: c.phone ?? "", email: c.email ?? "", hairType: c.hairType ?? "", notes: c.notes ?? "", consentMarketing: c.consentMarketing }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
