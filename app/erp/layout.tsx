import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { sessionIsMarketer } from "@/lib/staff-access";
import { ErpShell } from "@/components/erp/ErpShell";

export const metadata = { title: "Qasr ERP", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  // Marketers (STYLIST linked to a Marketing staff record) keep their earnings page in the nav.
  const { isMarketer } = session.role === "STYLIST" ? await sessionIsMarketer(session.sub) : { isMarketer: false };
  return (
    <ErpShell email={session.email} role={session.role} isMarketer={isMarketer}>
      {children}
    </ErpShell>
  );
}
