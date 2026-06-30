import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { UsersManager } from "@/components/erp/UsersManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users — Qasr Alshar ERP" };

export default async function ErpUsers() {
  const ok = await requireRole(["SUPER_ADMIN"]);
  if (!ok) redirect("/erp");

  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-cream">Users &amp; Access</h1>
        <p className="text-sm text-muted">Each person gets their own login. Every booking and bill is stamped with who entered it.</p>
      </div>
      <UsersManager users={users} currentUserId={ok.sub} />
    </div>
  );
}
