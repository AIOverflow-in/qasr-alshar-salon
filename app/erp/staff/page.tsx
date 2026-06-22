import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ErpStaff() {
  const ok = await requireRole(["SUPER_ADMIN", "ADMIN"]);
  if (!ok) redirect("/erp");

  const staff = await prisma.staff.findMany({ orderBy: { order: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Staff</h1>
        <p className="text-sm text-muted">{staff.length} team members · roles, schedules & commission</p>
      </div>

      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-ink-line text-left text-muted">
            <tr>
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Role</th>
              <th className="p-4 font-medium">Working Hours</th>
              <th className="p-4 font-medium">Off Day</th>
              <th className="p-4 font-medium">Commission</th>
              <th className="p-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line/60">
            {staff.map((s) => (
              <tr key={s.id}>
                <td className="p-4 font-medium text-cream">{s.name}</td>
                <td className="p-4 text-sand">{s.role}</td>
                <td className="p-4 text-muted">{s.hours}</td>
                <td className="p-4 text-muted">{s.offDay ?? "—"}</td>
                <td className="p-4 text-sand">{s.commissionPct}% · ref {s.referralPct}%</td>
                <td className="p-4">
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${s.active ? "border-green-500/40 text-green-400" : "border-muted/40 text-muted"}`}>
                    {s.active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Seeded from your staff sheet. Editing, attendance, payroll & per-stylist sales come in the next slice.
      </p>
    </div>
  );
}
