import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AttendanceManager } from "@/components/erp/AttendanceManager";
import { Pagination } from "@/components/erp/Pagination";
import { parsePage, pageWindow } from "@/lib/pagination-core";

export const dynamic = "force-dynamic";
export const metadata = { title: "Attendance — Qasr Alshar ERP" };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (!(await requireRole(["SUPER_ADMIN", "ADMIN"]))) redirect("/erp");

  const total = await prisma.attendancePunch.count({ where: {} });
  const win = pageWindow(total, parsePage((await searchParams).page));
  const [punches, staff, unmapped] = await Promise.all([
    prisma.attendancePunch.findMany({
      orderBy: { punchedAt: "desc" }, skip: win.skip, take: win.take,
      select: { id: true, pin: true, punchedAt: true, status: true, verifyMode: true, staff: { select: { name: true } } },
    }),
    prisma.staff.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true, biometricPin: true } }),
    // Unmapped device PINs across ALL punches (not just this page) so the "map these" banner is complete.
    prisma.attendancePunch.findMany({ where: { staffId: null }, distinct: ["pin"], select: { pin: true }, take: 100 }),
  ]);
  const unmappedPins = [...new Set(unmapped.map((p) => p.pin))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Attendance</h1>
        <p className="text-sm text-muted">Live punches from the fingerprint terminal. Map each staff member&apos;s device PIN to link their scans.</p>
      </div>
      <AttendanceManager
        punches={punches.map((p) => ({ id: p.id, pin: p.pin, punchedAt: p.punchedAt.toISOString(), status: p.status, verifyMode: p.verifyMode, staffName: p.staff?.name ?? null }))}
        staff={staff.map((s) => ({ id: s.id, name: s.name, pin: s.biometricPin }))}
        unmappedPins={unmappedPins}
      />
      <Pagination total={win.total} page={win.page} size={win.size} />
    </div>
  );
}
