import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ServicesManager } from "@/components/erp/ServicesManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Services — Qasr Alshar ERP" };

export default async function ErpServices() {
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) redirect("/erp");

  const services = await prisma.service.findMany({
    orderBy: [{ category: "asc" }, { order: "asc" }],
    select: { id: true, name: true, category: true, priceAED: true, durationMin: true, active: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Services</h1>
        <p className="text-sm text-muted">Add new services, edit prices/duration, or hide ones you no longer offer.</p>
      </div>
      <ServicesManager services={services} />
    </div>
  );
}
