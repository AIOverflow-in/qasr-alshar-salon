import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { sessionIsMarketer } from "@/lib/staff-access";

export const dynamic = "force-dynamic";

/** Routes to the right home: managers → staff list, marketer → own earnings, others → calendar. */
export default async function MyWork() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  // Admins don't have a personal artist page — send them to the staff list.
  if (session.role === "SUPER_ADMIN" || session.role === "ADMIN") redirect("/erp/staff");

  // Only a marketer keeps an earnings page; every other crown artist is calendar-only.
  if (session.role === "STYLIST") {
    const { isMarketer, staffId } = await sessionIsMarketer(session.sub);
    if (isMarketer && staffId) redirect(`/erp/staff/${staffId}`);
    redirect("/erp/calendar");
  }
  redirect("/erp");
}
