import "server-only";
import crypto from "node:crypto";

/**
 * Stable, hard-to-guess token for the public bookings calendar feed.
 * Derived from AUTH_SECRET so it needs no extra env var and isn't guessable.
 */
export function calendarToken(): string {
  // Fail closed — never fall back to a committed, guessable secret (the feed exposes client PII).
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET is missing or too short (need ≥ 32 chars).");
  return crypto.createHash("sha256").update(`${secret}:bookings-calendar`).digest("hex").slice(0, 32);
}
