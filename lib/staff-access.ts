import "server-only";
import { prisma } from "./prisma";

/**
 * Access nuance for the crown-artist lockdown: service crown artists are calendar-only, but a
 * MARKETER (a STYLIST whose linked Staff role is Marketing) keeps their own earnings page.
 */
export function isMarketerRole(role?: string | null): boolean {
  return /market/i.test(role ?? "");
}

/** For a logged-in session: is it a STYLIST linked to a Marketing staff record, and their staffId. */
export async function sessionIsMarketer(sub: string): Promise<{ isMarketer: boolean; staffId: string | null }> {
  const me = await prisma.adminUser.findUnique({ where: { id: sub }, select: { staffId: true } });
  if (!me?.staffId) return { isMarketer: false, staffId: null };
  const st = await prisma.staff.findUnique({ where: { id: me.staffId }, select: { role: true } });
  return { isMarketer: isMarketerRole(st?.role), staffId: me.staffId };
}
