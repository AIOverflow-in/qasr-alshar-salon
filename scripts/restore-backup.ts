// Restore a nightly backup into a database. READ THIS BEFORE RUNNING.
//
// Refuses to touch production unless you pass --i-understand-this-overwrites-production, because
// a restore DELETES existing rows before inserting. The default target is your LOCAL database.
//
//   BACKUP_FILE=./qasr-2026-08-31.json.gz node --import tsx --env-file=.env.local scripts/restore-backup.ts
//   …same… --apply                                        # actually write
//
// Download a backup first with scripts/fetch-backup.ts (it is a PRIVATE blob, not a public URL).
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { PrismaClient, Prisma } from "@prisma/client";
import { jsonReviver } from "../lib/backup/core";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const FORCE_PROD = process.argv.includes("--i-understand-this-overwrites-production");
const FILE = process.env.BACKUP_FILE || "";

type Payload = {
  formatVersion: number;
  takenAt: string;
  day: string;
  counts: Record<string, number>;
  data: Record<string, Record<string, unknown>[]>;
};

async function main() {
  if (!FILE) throw new Error("Set BACKUP_FILE=/path/to/qasr-YYYY-MM-DD.json.gz");

  const url = process.env.DATABASE_URL || "";
  const isProd = /neon\.tech/i.test(url);
  if (isProd && !FORCE_PROD) {
    throw new Error("DATABASE_URL points at Neon (production). Refusing. Pass --i-understand-this-overwrites-production if that is genuinely what you want.");
  }

  const payload = JSON.parse(gunzipSync(readFileSync(FILE)).toString("utf8"), jsonReviver) as Payload;
  if (payload.formatVersion !== 1) throw new Error(`Unknown backup format v${payload.formatVersion}.`);

  // Restore parents before children so foreign keys resolve; delete in the reverse order.
  // DMMF lists models in schema order, which is not dependency order, so sort by how many
  // relations each model DEPENDS on.
  const models = Prisma.dmmf.datamodel.models;
  const dependsOn = new Map(models.map((m) => [m.name, m.fields.filter((f) => f.relationName && f.relationFromFields?.length).map((f) => f.type)]));
  const ordered: string[] = [];
  const visit = (name: string, seen = new Set<string>()) => {
    if (ordered.includes(name) || seen.has(name)) return;
    seen.add(name);
    for (const dep of dependsOn.get(name) ?? []) visit(dep, seen);
    if (!ordered.includes(name)) ordered.push(name);
  };
  for (const m of models) visit(m.name);

  console.log(`Backup taken ${payload.takenAt} (${payload.day})`);
  console.log(`Target: ${isProd ? "PRODUCTION" : "local"} — ${url.replace(/:[^:@]+@/, ":***@").slice(0, 70)}`);
  const total = Object.values(payload.counts).reduce((a, b) => a + b, 0);
  console.log(`Contains ${Object.keys(payload.data).length} tables, ${total} rows\n`);

  if (!APPLY) {
    for (const name of ordered) {
      const n = payload.counts[name] ?? 0;
      if (n) console.log(`  ${name.padEnd(24)} would restore ${n}`);
    }
    console.log("\nDRY RUN — nothing written. Re-run with --apply.");
    return;
  }

  const delegate = (name: string) =>
    (prisma as unknown as Record<string, { deleteMany: () => Promise<unknown>; createMany: (a: unknown) => Promise<{ count: number }> }>)[
      name.charAt(0).toLowerCase() + name.slice(1)
    ];

  for (const name of [...ordered].reverse()) await delegate(name)?.deleteMany();
  let restored = 0;
  for (const name of ordered) {
    const rows = payload.data[name] ?? [];
    if (!rows.length) continue;
    const res = await delegate(name).createMany({ data: rows, skipDuplicates: true });
    restored += res.count;
    console.log(`  ${name.padEnd(24)} ${res.count}/${rows.length}`);
  }

  // Prove it: compare live counts against what the file said it held.
  console.log("\nVerifying…");
  let bad = 0;
  for (const [name, expected] of Object.entries(payload.counts)) {
    const actual = await (prisma as unknown as Record<string, { count: () => Promise<number> }>)[name.charAt(0).toLowerCase() + name.slice(1)]?.count();
    if (actual !== expected) { console.log(`  MISMATCH ${name}: expected ${expected}, got ${actual}`); bad++; }
  }
  console.log(bad === 0 ? `\nAll ${restored} rows restored and verified.` : `\n${bad} table(s) did not match — DO NOT trust this restore.`);
  if (bad) process.exitCode = 1;
}

main().catch((e) => { console.error("FAILED:", e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
