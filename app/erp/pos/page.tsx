import { prisma } from "@/lib/prisma";
import { PosTerminal } from "./PosTerminal";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "POS Checkout — Qasr Alshar ERP" };

export default async function PosPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const allowed = ["SUPER_ADMIN", "ADMIN", "RECEPTION"];
  if (!allowed.includes(session.role)) redirect("/erp");

  const [services, staff, clients] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { category: "asc" }, select: { id: true, name: true, category: true, priceAED: true, durationMin: true } }),
    prisma.staff.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, take: 500, select: { id: true, name: true, phone: true } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-cream">POS Checkout</h1>
      <PosTerminal services={services} staff={staff} clients={clients} />
    </div>
  );
}
