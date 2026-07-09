import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  // Role gate (this legacy /admin panel mirrors the /erp data). Without it, a
  // STYLIST or INVESTOR could read the whole salon's customer PII by typing the
  // URL. Front-desk roles and up only; per-page guards below narrow further.
  if (!["SUPER_ADMIN", "ADMIN", "RECEPTION"].includes(session.role)) redirect("/erp");

  return <AdminShell email={session.email}>{children}</AdminShell>;
}
