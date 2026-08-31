import "server-only";
import { gzipSync } from "node:zlib";
import { put, list, del } from "@vercel/blob";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyRetention, backupKey, dubaiDay, jsonReplacer } from "./core";

export type BackupResult = {
  ok: boolean;
  key?: string;
  bytes?: number;
  tables?: number;
  rows?: number;
  pruned?: number;
  skipped?: string;
};

/**
 * Every model is discovered from Prisma's DMMF rather than listed by hand. A table added to the
 * schema and forgotten here would be silently absent from every backup — the failure would only
 * surface during a restore, which is the worst possible moment to find it.
 */
function modelNames(): { model: string; delegate: string }[] {
  return Prisma.dmmf.datamodel.models.map((m) => ({
    model: m.name,
    delegate: m.name.charAt(0).toLowerCase() + m.name.slice(1),
  }));
}

export async function runBackup(now = new Date()): Promise<BackupResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, skipped: "no-blob-token" };

  const day = dubaiDay(now);
  const models = modelNames();
  const data: Record<string, unknown[]> = {};
  let rows = 0;

  for (const { model, delegate } of models) {
    const client = (prisma as unknown as Record<string, { findMany?: (a?: unknown) => Promise<unknown[]> }>)[delegate];
    if (!client?.findMany) continue;
    const found = await client.findMany();
    data[model] = found;
    rows += found.length;
  }

  const payload = {
    // Bumped only when the on-disk shape changes; restore refuses a version it does not understand.
    formatVersion: 1,
    takenAt: now.toISOString(),
    day,
    // Row counts are written alongside the data so a restore can prove nothing was lost in transit.
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
    data,
  };

  const body = gzipSync(Buffer.from(JSON.stringify(payload, jsonReplacer), "utf8"), { level: 9 });
  const key = backupKey(day);

  // PRIVATE, always. This file contains password hashes, passport and Emirates ID numbers, and
  // every client's phone number. A public blob URL would be a data breach even if unguessable.
  const blob = await put(key, body, {
    access: "private",
    contentType: "application/gzip",
    addRandomSuffix: false,   // one canonical object per day, so a re-run overwrites instead of piling up
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });

  // Prune old backups by the same rule every time, so storage cannot grow without bound.
  let pruned = 0;
  try {
    const existing = await list({ prefix: "db-backups/", limit: 1000 });
    const { drop } = applyRetention(existing.blobs.map((b) => b.pathname), day);
    const toDelete = existing.blobs.filter((b) => drop.includes(b.pathname)).map((b) => b.url);
    if (toDelete.length) { await del(toDelete); pruned = toDelete.length; }
  } catch (e) {
    // A pruning failure must never lose today's backup — it is already stored above.
    console.error("[backup] prune failed (backup itself is safe):", e instanceof Error ? e.message : e);
  }

  return { ok: true, key: blob.pathname, bytes: body.length, tables: Object.keys(data).length, rows, pruned };
}
