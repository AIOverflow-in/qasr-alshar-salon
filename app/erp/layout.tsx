import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ErpShell } from "@/components/erp/ErpShell";

export const metadata = { title: "Qasr ERP", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return (
    <ErpShell email={session.email} role={session.role}>
      {children}
    </ErpShell>
  );
}
