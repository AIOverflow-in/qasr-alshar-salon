import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ServicesManager } from "@/components/erp/ServicesManager";
import { parsePage, pageWindow } from "@/lib/pagination-core";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Services — Qasr Alshar ERP" };

export default async function ErpServices({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) redirect("/erp");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const where: Prisma.ServiceWhereInput = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }] }
    : {};

  const total = await prisma.service.count({ where });
  const win = pageWindow(total, parsePage(sp.page));
  const [services, catRows] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: [{ category: "asc" }, { order: "asc" }],
      select: { id: true, name: true, category: true, priceAED: true, durationMin: true, active: true },
      skip: win.skip,
      take: win.take,
    }),
    prisma.service.findMany({ distinct: ["category"], orderBy: { category: "asc" }, select: { category: true } }),
  ]);
  const categories = catRows.map((c) => c.category);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Services</h1>
        <p className="text-sm text-muted">Add new services, edit prices/duration, or hide ones you no longer offer.</p>
      </div>
      <ServicesManager services={services} categories={categories} total={win.total} page={win.page} size={win.size} q={q} />
    </div>
  );
}
