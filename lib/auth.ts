import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

const SESSION_COOKIE = "qa_admin";

const VALID_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "RECEPTION", "STYLIST", "INVESTOR"];

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
    return {
      sub: String(payload.sub),
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

export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}
