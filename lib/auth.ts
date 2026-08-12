import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

const SESSION_COOKIE = "qa_admin";

// Deliberately explicit, not derived from the Prisma enum: a session whose role isn't listed here
// gets NO access at all. Adding a role to the schema without adding it here fails closed, which is
// the behaviour we want. Add new roles here consciously.
const VALID_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "RECEPTION", "BOOKING", "STYLIST", "INVESTOR"];

function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    // Fail closed — never fall back to a guessable secret.
    throw new Error("AUTH_SECRET is missing or too short (need ≥ 32 chars).");
  }
  return new TextEncoder().encode(s);
}

export type Session = { sub: string; email: string; role: Role };

export async function createSession(user: { id: string; email: string; role: Role }) {
  const token = await new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    // Reject a token whose role claim is missing or not a known role — never
    // silently grant elevated access on a malformed/legacy token.
    const role = payload.role as Role | undefined;
    if (!role || !VALID_ROLES.includes(role)) return null;
    const sub = String(payload.sub);
    // Immediate revocation on offboarding: a deactivated account's 7-day token would otherwise stay
    // valid. Re-check the DB each request. A DB hiccup must not lock everyone out, so on error (or an
    // unknown sub, e.g. a token minted for a non-DB user) we trust the already-verified token.
    try {
      const u = await prisma.adminUser.findUnique({ where: { id: sub }, select: { active: true } });
      if (u && !u.active) return null;
    } catch { /* DB unavailable — fall through to the verified token */ }
    return {
      sub,
      email: String(payload.email),
      role,
    };
  } catch {
    return null;
  }
}

/** Roles allowed to see the finance/investor surfaces. */
export const FINANCE_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "INVESTOR"];

export async function requireRole(allowed: Role[]): Promise<Session | null> {
  const s = await getSession();
  if (!s || !allowed.includes(s.role)) return null;
  return s;
}

// A valid bcrypt hash (of a random string) used only to spend one compare on the miss path, so
// unknown/inactive emails don't respond faster than real ones (defeats account enumeration).
const DUMMY_HASH = "$2b$10$C6UzMDM.H6dfI/f/IKcEeO3jHhq3vX3q5Yl3sJ8oJ0oQx8kQ9y8pC";

export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user || !user.active) {
    await bcrypt.compare(password, DUMMY_HASH); // constant-time: same cost as a real check
    return null; // deactivated / unknown accounts cannot log in
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}
