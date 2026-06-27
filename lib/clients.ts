import "server-only";
import { prisma } from "./prisma";

/** Significant digits of a UAE number for fuzzy matching (last 9, ignoring 0/971/+ prefixes). */
export function phoneSig(raw?: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length < 7) return null;
  return d.slice(-9);
}

type Ident = { name: string; phone?: string | null; email?: string | null };

/**
 * Find an existing client or create one — deduped so repeat bookings never make
 * a second record. Matches by phone (format-insensitive) OR email, and for
 * name-only walk-ins by exact name. Returns the client id.
 */
export async function resolveClientId({ name, phone, email }: Ident): Promise<string> {
  const e = (email ?? "").trim().toLowerCase();
  const sig = phoneSig(phone);

  const or: object[] = [];
  if (sig) or.push({ phone: { contains: sig } });
  if (e) or.push({ email: e });

  let client = or.length ? await prisma.client.findFirst({ where: { OR: or }, select: { id: true } }) : null;

  // Name-only walk-in: avoid creating a duplicate of an identically-named record.
  if (!client && !sig && !e && name.trim()) {
    client = await prisma.client.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" } }, select: { id: true } });
  }

  if (!client) {
    client = await prisma.client.create({
      data: { name: name.trim(), phone: phone?.trim() || null, email: e || null },
    });
  }
  return client.id;
}

/**
 * Does this customer already have an active (CONFIRMED, not-yet-finished) booking?
 * Used to block a second booking while one is still open. Matched by client id,
 * else by phone/email.
 */
export async function hasActiveBooking(opts: { clientId?: string | null; phone?: string | null; email?: string | null }): Promise<boolean> {
  const now = new Date();
  const or: object[] = [];
  if (opts.clientId) or.push({ clientId: opts.clientId });
  const sig = phoneSig(opts.phone);
  if (sig) or.push({ phone: { contains: sig } });
  const e = (opts.email ?? "").trim().toLowerCase();
  if (e) or.push({ email: e });
  if (!or.length) return false;

  const existing = await prisma.booking.findFirst({
    where: { status: "CONFIRMED", endAt: { gt: now }, OR: or },
    select: { id: true },
  });
  return !!existing;
}
