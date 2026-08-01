import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "../prisma";

/**
 * Remembers the SQL generated for a question so asking it again costs no AI tokens.
 *
 * We cache the QUERY, never the numbers — the statement is re-executed on every hit, so "today's
 * takings" is always today's. That is what makes an indefinite cache safe.
 *
 * Two layers: a per-instance Map (skips the DB during a burst) in front of one Postgres table
 * (shared across serverless instances, and doubles as the feature's analytics).
 */

/** Bump when SYSTEM_PROMPT or the schema card changes — instantly retires every stale query. */
const PROMPT_VERSION = 1;

export type CachedSql = { sql: string; title: string };

const mem = new Map<string, CachedSql>();
const MEM_MAX = 200;

/**
 * Conservative normalisation only. No stemming, no synonym mapping: "how much" vs "how many",
 * "this month" vs "last month" are meaning-bearing, and an over-eager normaliser would serve the
 * WRONG remembered query — the worst possible failure here, because nobody re-checks the number.
 */
export function normalizeQuestion(q: string): string {
  return q
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/^(hi|hey|hello|ok|okay)?[\s,]*(please|pls)?[\s,]*(can|could|would)\s+you[\s,]*/, "")
    .replace(/^(please|pls|just)\s+/, "")
    .replace(/[?!.\s]+$/, "")
    .replace(/[^\p{L}\p{N}%'\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export function questionHash(q: string): string {
  return createHash("sha256").update(`v${PROMPT_VERSION}|${normalizeQuestion(q)}`).digest("hex").slice(0, 32);
}

/** Remembered SQL for this question, if we've answered it before. */
export async function getCachedSql(question: string): Promise<CachedSql | null> {
  const hash = questionHash(question);
  const hit = mem.get(hash);
  if (hit) { void bumpHits(hash); return hit; }

  try {
    const row = await prisma.assistantQuery.findUnique({
      where: { hash },
      select: { sql: true, title: true, status: true },
    });
    if (!row || row.status !== "SQL" || !row.sql) return null;
    const value = { sql: row.sql, title: row.title ?? "Result" };
    remember(hash, value);
    void bumpHits(hash);
    return value;
  } catch (e) {
    console.error("[assistant/cache] lookup failed (continuing without cache):", e);
    return null;
  }
}

/** Store the SQL we just generated so the next identical question is free. */
export async function rememberSql(question: string, sql: string, title: string): Promise<void> {
  const hash = questionHash(question);
  remember(hash, { sql, title });
  try {
    await prisma.assistantQuery.upsert({
      where: { hash },
      create: { hash, question: question.slice(0, 500), status: "SQL", sql, title },
      update: { sql, title, status: "SQL", lastAskedAt: new Date() },
    });
  } catch (e) {
    console.error("[assistant/cache] save failed (answer still returned):", e);
  }
}

/** Log a question we couldn't answer — this list is the roadmap for what to support next. */
export async function recordClarify(question: string): Promise<void> {
  const hash = questionHash(question);
  try {
    await prisma.assistantQuery.upsert({
      where: { hash },
      create: { hash, question: question.slice(0, 500), status: "CLARIFY" },
      update: { hits: { increment: 1 }, lastAskedAt: new Date() },
    });
  } catch { /* analytics only — never block an answer */ }
}

function remember(hash: string, value: CachedSql): void {
  if (mem.size >= MEM_MAX) mem.delete(mem.keys().next().value as string);
  mem.set(hash, value);
}

async function bumpHits(hash: string): Promise<void> {
  try {
    await prisma.assistantQuery.update({ where: { hash }, data: { hits: { increment: 1 }, lastAskedAt: new Date() } });
  } catch { /* counter only */ }
}
