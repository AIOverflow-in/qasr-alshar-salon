import type { Role } from "@prisma/client";

/**
 * The single source of truth for ERP roles.
 *
 * Deliberately explicit, not derived from the Prisma enum: a session whose role isn't listed here
 * gets NO access at all. Adding a role to the schema without adding it here fails closed, which is
 * the behaviour we want. Add new roles here consciously.
 *
 * This lives apart from lib/auth.ts because that module is `server-only` — maintenance scripts
 * (scripts/add-staff.ts) need the list too, and importing auth.ts from plain node crashes on
 * `server-only`. Keeping the list pure lets both sides share one copy; a second hardcoded copy is
 * exactly what once made "Bookings only" fail with "Invalid role."
 */
export const ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "RECEPTION", "BOOKING", "STYLIST", "INVESTOR"];
