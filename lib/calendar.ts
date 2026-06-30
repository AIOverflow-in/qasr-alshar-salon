import "server-only";
import crypto from "node:crypto";

/**
 * Stable, hard-to-guess token for the public bookings calendar feed.
 * Derived from AUTH_SECRET so it needs no extra env var and isn't guessable.
 */
export function calendarToken(): string {
  const secret = process.env.AUTH_SECRET ?? "qasr-alshar-fallback-secret";
  return crypto.createHash("sha256").update(`${secret}:bookings-calendar`).digest("hex").slice(0, 32);
}
