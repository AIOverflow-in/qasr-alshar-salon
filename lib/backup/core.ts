/**
 * Pure helpers for the nightly database backup. No prisma, no network — unit-tested in core.test.ts.
 */

/** Backup file name for a Dubai calendar day. Sorts chronologically as a string. */
export function backupKey(dayISO: string): string {
  return `db-backups/qasr-${dayISO}.json.gz`;
}

/** Dubai calendar day ("YYYY-MM-DD") for an instant. Backups are named by the salon's day, not UTC. */
export function dubaiDay(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(at);
}

/**
 * JSON.stringify replacer. Prisma hands back types JSON cannot represent: Date, BigInt, Decimal,
 * Buffer.
 *
 * It reads `this[key]` rather than the `value` argument, and that is not a style choice: JSON
 * .stringify calls `toJSON()` on a value BEFORE handing it to the replacer, so a Date arrives here
 * already flattened to a string and `value instanceof Date` is never true. Every date would then
 * restore as a string. `this[key]` is the untouched original.
 *
 * Restore reads these back by shape, so the tags must stay stable.
 */
export function jsonReplacer(this: Record<string, unknown>, key: string, value: unknown): unknown {
  const raw = this?.[key] ?? value;
  if (typeof raw === "bigint") return { __t: "bigint", v: raw.toString() };
  if (raw instanceof Date) return { __t: "date", v: raw.toISOString() };
  if (raw instanceof Uint8Array) return { __t: "b64", v: Buffer.from(raw).toString("base64") };
  // Prisma Decimal is an object carrying toFixed; keep full precision as a string.
  if (raw && typeof raw === "object" && !Array.isArray(raw)
      && typeof (raw as { toFixed?: unknown }).toFixed === "function") {
    return { __t: "decimal", v: String(raw) };
  }
  return value;
}

/** Inverse of jsonReplacer, for restore. */
export function jsonReviver(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && "__t" in value && "v" in value) {
    const { __t, v } = value as { __t: string; v: string };
    if (__t === "bigint") return BigInt(v);
    if (__t === "date") return new Date(v);
    if (__t === "b64") return Buffer.from(v, "base64");
    if (__t === "decimal") return v; // Prisma accepts a string for Decimal columns
  }
  return value;
}

export type Retention = { keep: string[]; drop: string[] };

/**
 * Which backups to keep: every one from the last `recentDays` days, plus the FIRST backup of each
 * month for `monthlyMonths` months. Everything else is dropped.
 *
 * The window is 56 days rather than 30 because the job runs WEEKLY: a 30-day window would hold
 * only four files, so a fortnight of unnoticed corruption would have no clean copy behind it.
 *
 * Keeping the first of the month rather than the last means a monthly restore point survives even
 * if the salon closes mid-month, and it never collides with a daily we are already keeping.
 */
export function applyRetention(
  keys: string[],
  today: string,
  recentDays = 56,        // eight weekly runs
  monthlyMonths = 12,
): Retention {
  const days = keys
    .map((k) => ({ k, d: k.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null }))
    .filter((x): x is { k: string; d: string } => !!x.d)
    .sort((a, b) => (a.d < b.d ? 1 : -1)); // newest first

  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - recentDays);
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  const firstOfMonth = new Map<string, string>();
  for (const { d } of [...days].reverse()) {          // oldest first, so the first seen wins
    const m = d.slice(0, 7);
    if (!firstOfMonth.has(m)) firstOfMonth.set(m, d);
  }
  const monthsKept = new Set([...firstOfMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, monthlyMonths)
    .map(([, d]) => d));

  const keep: string[] = [], drop: string[] = [];
  for (const { k, d } of days) {
    if (d >= cutoffISO || monthsKept.has(d)) keep.push(k); else drop.push(k);
  }
  return { keep, drop };
}
