import "server-only";
import { prisma } from "../prisma";
import { MAX_ROWS } from "./sql-guard";

/**
 * Executes validated, model-written SQL inside a READ ONLY transaction.
 *
 * This is the layer that makes "read-only" a database guarantee rather than a promise from the
 * validator: Postgres itself rejects any INSERT/UPDATE/DELETE/DDL once the transaction is marked
 * read-only, so even a bug in sql-guard.ts cannot mutate data.
 *
 * SET LOCAL is required (not plain SET) because DATABASE_URL points at Neon's PgBouncer pooler,
 * where session-level settings do not survive between statements.
 */

const STATEMENT_TIMEOUT_MS = 4_000;
const TXN_TIMEOUT_MS = 8_000;

export type SqlRows = Record<string, unknown>[];
export type SqlRunResult =
  | { ok: true; rows: SqlRows; truncated: boolean }
  | { ok: false; kind: "timeout" | "badsql" | "error" };

/** Raw Postgres values → JSON-safe. count(*) returns a BigInt, which NextResponse.json() throws on. */
function normalizeCell(v: unknown): unknown {
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v === "object" && typeof (v as { toNumber?: unknown }).toNumber === "function") {
    return Number((v as { toNumber: () => number }).toNumber()); // Prisma Decimal from avg()/numeric
  }
  if (Array.isArray(v)) return v.slice(0, 10).join(", ");
  if (typeof v === "string") return v.length > 120 ? `${v.slice(0, 120)}…` : v;
  return v;
}

function normalizeRow(r: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(r).slice(0, 8).map(([k, v]) => [k, normalizeCell(v)]));
}

export async function runReadOnlySql(sql: string): Promise<SqlRunResult> {
  try {
    const rows = await prisma.$transaction(
      async (tx) => {
        // MUST be first: from here Postgres refuses every write, whatever slipped past the guard.
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT_MS}ms'`);
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '1000ms'");
        return await tx.$queryRawUnsafe<SqlRows>(sql);
      },
      { timeout: TXN_TIMEOUT_MS, maxWait: 2_000 },
    );
    return { ok: true, rows: rows.slice(0, MAX_ROWS).map(normalizeRow), truncated: rows.length > MAX_ROWS };
  } catch (e) {
    // Postgres SQLSTATE travels on PrismaClientKnownRequestError.meta.code for raw queries.
    const pg = (e as { meta?: { code?: string } })?.meta?.code;
    console.error("[assistant/sql] query failed", { pg, sql });
    if (pg === "57014") return { ok: false, kind: "timeout" }; // statement_timeout
    if (pg === "25006") {
      // A write reached the database. The guard was bypassed — this should never happen.
      console.error("[assistant/sql] ALERT: write attempted in read-only transaction", { sql });
      return { ok: false, kind: "error" };
    }
    if (pg && /^(42|22|0A)/.test(pg)) return { ok: false, kind: "badsql" }; // syntax / undefined column
    return { ok: false, kind: "error" };
  }
}
