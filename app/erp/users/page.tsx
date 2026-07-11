import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { UsersManager } from "@/components/erp/UsersManager";
import { Pagination } from "@/components/erp/Pagination";
import { parsePage, pageWindow } from "@/lib/pagination-core";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users — Qasr Alshar ERP" };

export default async function ErpUsers({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const ok = await requireRole(["SUPER_ADMIN"]);
  if (!ok) redirect("/erp");

  const total = await prisma.adminUser.count();
  const win = pageWindow(total, parsePage((await searchParams).page));
  const [rows, staff, unlinked] = await Promise.all([
    prisma.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, active: true, staffId: true },
      skip: win.skip,
      take: win.take,
    }),
    prisma.staff.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true, role: true } }),
    // Guardrail: EVERY unlinked crown-artist login (across all pages), so none is missed.
    prisma.adminUser.findMany({ where: { role: "STYLIST", staffId: null }, select: { id: true, name: true, email: true } }),
  ]);
  const staffName = new Map(staff.map((s) => [s.id, s.name] as const));
  const users = rows.map((u) => ({ ...u, staffName: u.staffId ? staffName.get(u.staffId) ?? null : null }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-cream">Users &amp; Access</h1>
        <p className="text-sm text-muted">Each person gets their own login. Every booking and bill is stamped with who entered it.</p>
      </div>
      <UsersManager users={users} staff={staff} unlinked={unlinked} currentUserId={ok.sub} />
      <Pagination total={win.total} page={win.page} size={win.size} />
    </div>
  );
}
