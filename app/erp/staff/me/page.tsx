import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Sends a logged-in Crown Artist to their own performance page. */
export default async function MyWork() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  // Admins don't have a personal artist page — send them to the staff list.
  if (session.role === "SUPER_ADMIN" || session.role === "ADMIN") redirect("/erp/staff");

  const me = await prisma.adminUser.findUnique({ where: { id: session.sub }, select: { staffId: true } });
  if (me?.staffId) redirect(`/erp/staff/${me.staffId}`);

  // Logged in but not linked to a Crown Artist record yet.
  return (
    <div className="surface mx-auto mt-10 max-w-md rounded-2xl border border-ink-line p-8 text-center">
      <h1 className="font-display text-2xl text-cream">No artist profile linked</h1>
      <p className="mt-2 text-sm text-muted">Your login isn’t linked to a Crown Artist record yet. Ask an admin to link it in Users, and your work will appear here.</p>
    </div>
  );
}
