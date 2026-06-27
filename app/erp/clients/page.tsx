import { prisma } from "@/lib/prisma";
import { ClientsManager } from "./ClientsManager";
import { ClientsGrid } from "@/components/erp/ClientsGrid";

export const dynamic = "force-dynamic";

export default async function ErpClients() {
  const clients = await prisma.client.findMany({
    orderBy: { updatedAt: "desc" },
    take: 2000,
    include: {
      salesOrders: {
        where: { status: "PAID" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { invoiceNo: true, totalAED: true, createdAt: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-cream">Clients</h1>
          <p className="text-sm text-muted">{clients.length} clients in CRM</p>
        </div>
        <ClientsManager />
      </div>

      <ClientsGrid
        clients={clients.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          hairType: c.hairType,
          notes: c.notes,
          visits: c.visits,
          totalSpentAED: c.totalSpentAED,
          consentMarketing: c.consentMarketing,
          salesOrders: c.salesOrders.map((o) => ({ invoiceNo: o.invoiceNo, totalAED: o.totalAED, createdAt: o.createdAt.toISOString() })),
        }))}
      />
    </div>
  );
}
