import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { parsePage, pageWindow } from "@/lib/pagination-core";
import { ClientsManager } from "./ClientsManager";
import { ClientsGrid } from "@/components/erp/ClientsGrid";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ErpClients({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  if (!(await requireRole(["SUPER_ADMIN", "ADMIN", "RECEPTION"]))) redirect("/erp");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const where: Prisma.ClientWhereInput = q
    ? { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ] }
    : {};

  const total = await prisma.client.count({ where });
  const win = pageWindow(total, parsePage(sp.page));
  const clients = await prisma.client.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: win.skip,
    take: win.take,
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
          <p className="text-sm text-muted">{total} clients in CRM</p>
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
        total={win.total}
        page={win.page}
        size={win.size}
      />
    </div>
  );
}
