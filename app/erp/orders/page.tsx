import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ShopOrdersManager } from "@/components/erp/ShopOrdersManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shop Orders — Qasr Alshar ERP" };

type Item = { productId: string; name: string; priceAED: number; qty: number; lineAED: number };

export default async function ShopOrdersPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const canEdit = ["SUPER_ADMIN", "ADMIN", "RECEPTION"].includes(session.role);
  if (!canEdit) redirect("/erp");

  const orders = await prisma.shopOrder.findMany({ orderBy: { createdAt: "desc" }, take: 300 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Shop Orders</h1>
        <p className="text-sm text-muted">Cash-on-delivery orders from the storefront. Confirm → ship → deliver; cancelling restocks the items.</p>
      </div>
      <ShopOrdersManager
        canEdit={canEdit}
        orders={orders.map((o) => ({
          id: o.id, ref: "QA-SH-" + o.id.slice(-6).toUpperCase(), customerName: o.customerName, phone: o.phone, email: o.email,
          address: o.address, emirate: o.emirate, items: (Array.isArray(o.items) ? o.items : []) as unknown as Item[],
          itemCount: o.itemCount, totalAED: o.totalAED, status: o.status, createdAt: o.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
