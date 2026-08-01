/**
 * THE SECURITY BOUNDARY for the assistant's free-form tier: validates a model-written SQL string
 * before it is allowed anywhere near the database.
 *
 * Pure — no I/O, no env, no Prisma — so it is unit-testable and importable from scripts/e2e.mjs,
 * exactly like validatePlan() in intents.ts.
 *
 * Why a tokenizer and not regexes: regexes produce false positives (OFFSET contains "SET") and
 * false negatives (a client note reading 'drop table', or DR/**\/OP, or $$dollar quoting$$).
 * Lexing once lets us match keywords ONLY against bare identifiers and discard string contents.
 *
 * This is one layer of four. The others: the schema card omits secrets entirely, the executor
 * runs inside a READ ONLY transaction, and DENY_TOKENS blocks sensitive names in any position.
 */
import { ALLOWED_TABLES, ALLOWED_COLUMNS, ALLOWED_LC, DENY_TOKENS } from "./schema-card";

export const MAX_SQL_CHARS = 2000;
export const MAX_ROWS = 50;

export type SqlCheck =
  | { ok: true; sql: string }
  /** `reason` is for SERVER LOGS ONLY — never surface it to the user. */
  | { ok: false; reason: string };

type Tok = { k: "id" | "qid" | "num" | "str" | "op"; v: string; lc: string; depth: number };

/** Statement types and anything that mutates, locks, or escapes a SELECT. Bare tokens only. */
const BANNED = new Set([
  "insert", "update", "delete", "drop", "alter", "create", "truncate", "grant", "revoke",
  "comment", "copy", "call", "do", "execute", "prepare", "deallocate", "vacuum", "analyze",
  "reindex", "cluster", "refresh", "listen", "notify", "lock", "merge", "into", "returning",
  "set", "reset", "begin", "start", "commit", "rollback", "savepoint", "release", "declare",
  "fetch", "move", "close", "discard", "checkpoint", "security", "definer", "language",
  "function", "procedure", "trigger", "rule", "policy", "role", "user", "password", "owner",
  "tablespace", "extension", "import", "foreign", "server", "wrapper", "temp", "temporary",
  "unlogged", "materialized", "for", "share", "nowait", "locked", "setof", "current_setting",
  "set_config", "dblink", "lo_import", "lo_export",
]);

/** Functions the model may call. An ALLOWLIST kills pg_sleep/pg_read_file/dblink in one rule. */
const CALLABLE = new Set([
  "count", "sum", "avg", "min", "max", "round", "abs", "ceil", "ceiling", "floor", "mod",
  "greatest", "least", "coalesce", "nullif", "length", "char_length", "upper", "lower", "initcap",
  "trim", "btrim", "ltrim", "rtrim", "concat", "concat_ws", "substr", "substring", "position",
  "strpos", "replace", "split_part", "left", "right", "to_char", "to_date", "to_number",
  "date_trunc", "date_part", "extract", "age", "now", "make_date", "row_number", "rank",
  "dense_rank", "ntile", "lag", "lead", "first_value", "last_value", "percentile_cont",
  "percentile_disc", "string_agg", "array_agg", "bool_and", "bool_or", "stddev", "variance",
  "corr", "cast", "any", "all", "unnest", "cardinality", "array_length", "nth_value",
]);

/** Reserved words that legitimately appear bare inside a SELECT. */
const KEYWORDS = new Set([
  "select", "from", "where", "group", "by", "having", "order", "limit", "offset", "as", "on",
  "join", "inner", "left", "right", "full", "outer", "cross", "lateral", "using", "natural",
  "and", "or", "not", "in", "is", "null", "true", "false", "like", "ilike", "similar", "between",
  "case", "when", "then", "else", "end", "distinct", "asc", "desc", "nulls", "first", "last",
  "union", "all", "except", "intersect", "with", "recursive", "exists", "any", "some",
  "over", "partition", "rows", "range", "preceding", "following", "unbounded", "current", "row",
  "filter", "within", "at", "time", "zone", "interval", "date", "timestamp",
  // extract()/date_part() field names
  "year", "quarter", "month", "week", "day", "dow", "doy", "hour", "minute", "second", "epoch",
]);

/** Types permitted after a `::` cast. */
const CAST_TYPES = new Set([
  "int", "int2", "int4", "int8", "integer", "bigint", "smallint", "numeric", "decimal",
  "real", "float", "float4", "float8", "double", "precision", "text", "varchar", "char",
  "boolean", "bool", "date", "timestamp", "timestamptz", "time", "interval", "json", "jsonb",
]);

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Lex SQL into tokens; string contents are discarded so their text can never trip a keyword. */
function lex(sql: string): Tok[] | { error: string } {
  const toks: Tok[] = [];
  let i = 0, depth = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (/\s/.test(ch)) { i++; continue; }

    // String literal — consume whole, keep nothing. Handles the '' escape.
    if (ch === "'") {
      i++;
      while (i < sql.length) {
        if (sql[i] === "'") { if (sql[i + 1] === "'") { i += 2; continue; } i++; break; }
        i++;
      }
      toks.push({ k: "str", v: "'…'", lc: "", depth });
      continue;
    }

    // Quoted identifier — must be a plain identifier inside.
    if (ch === '"') {
      const end = sql.indexOf('"', i + 1);
      if (end < 0) return { error: "unterminated quoted identifier" };
      const inner = sql.slice(i + 1, end);
      if (!IDENT_RE.test(inner)) return { error: `bad quoted identifier: ${inner}` };
      toks.push({ k: "qid", v: inner, lc: inner.toLowerCase(), depth });
      i = end + 1;
      continue;
    }

    if (/[0-9]/.test(ch)) {
      let j = i; while (j < sql.length && /[0-9.]/.test(sql[j])) j++;
      const v = sql.slice(i, j);
      toks.push({ k: "num", v, lc: v, depth });
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i; while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j])) j++;
      const v = sql.slice(i, j);
      // An identifier glued to a quote is an escape-string literal (E'…', U&'…') — reject.
      if (sql[j] === "'" || sql[j] === '"') return { error: `escape-string literal near ${v}` };
      toks.push({ k: "id", v, lc: v.toLowerCase(), depth });
      i = j;
      continue;
    }

    if (ch === "(") { toks.push({ k: "op", v: ch, lc: ch, depth }); depth++; i++; continue; }
    if (ch === ")") { depth--; if (depth < 0) return { error: "unbalanced parentheses" }; toks.push({ k: "op", v: ch, lc: ch, depth }); i++; continue; }

    if ("*+-/%<>=!|:,.[]".includes(ch)) { toks.push({ k: "op", v: ch, lc: ch, depth }); i++; continue; }

    return { error: `illegal character ${JSON.stringify(ch)}` };
  }
  if (depth !== 0) return { error: "unbalanced parentheses" };
  return toks;
}

/**
 * Identifiers being DECLARED (table aliases, CTE names, output column labels) rather than
 * referenced. Output labels may be quoted — `SELECT sum(x) AS "totalAED"` — and are then referenced
 * again in ORDER BY / GROUP BY, so both forms are collected. An alias is only a label: the VALUE
 * still comes from an expression that is itself validated, and DENY_TOKENS is checked first, so a
 * label can never smuggle out a secret.
 */
function collectAliases(toks: Tok[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i], prev = toks[i - 1], next = toks[i + 1];
    if (t.k !== "id" && t.k !== "qid") continue;
    if (t.k === "id" && KEYWORDS.has(t.lc)) continue;
    if (prev && prev.k === "id" && (prev.lc === "as" || prev.lc === "with")) out.add(t.lc);      // AS x / AS "x" / WITH x
    else if (t.k === "id" && next && next.k === "id" && next.lc === "as") out.add(t.lc);          // x AS (...)
    else if (t.k === "id" && prev && (prev.k === "qid" || prev.v === ")")) out.add(t.lc);         // "Staff" s / (...) s
    else if (t.k === "id" && prev && prev.v === "," && next && next.v === ".") out.add(t.lc);     // FROM a, b
  }
  return out;
}

/** Always enforce a row cap. A LIMIT inside a subquery (depth > 0) is not the outer one. */
function withRowCap(sql: string, toks: Tok[]): string {
  let idx = -1;
  for (let i = 0; i < toks.length; i++) if (toks[i].k === "id" && toks[i].lc === "limit" && toks[i].depth === 0) idx = i;
  if (idx < 0) return `${sql} LIMIT ${MAX_ROWS}`;
  const nxt = toks[idx + 1];
  const n = nxt && nxt.k === "num" ? Number(nxt.v) : NaN;
  if (Number.isInteger(n) && n >= 1 && n <= MAX_ROWS && !toks[idx + 2]) return sql;
  // LIMIT ALL / LIMIT 100000 / LIMIT <expr> / LIMIT n OFFSET m → wrap so the cap always applies.
  return `SELECT * FROM (${sql}) AS _capped LIMIT ${MAX_ROWS}`;
}

/** Validate model-written SQL. Returns the (row-capped) statement, or a log-only reason. */
export function validateSql(raw: unknown): SqlCheck {
  if (typeof raw !== "string") return { ok: false, reason: "not a string" };
  let sql = raw.trim().replace(/;\s*$/, "").trim();
  if (!sql) return { ok: false, reason: "empty" };
  if (sql.length > MAX_SQL_CHARS) return { ok: false, reason: "too long" };

  // Character gate. Banning `$` outright kills dollar-quoting ($$…$$), the best way to hide a
  // semicolon or comment from a scanner, plus bind-param smuggling. Cheap, few false positives.
  for (const bad of [";", "$", "\\", "`", "--", "/*", "*/", "\u0000"]) {
    if (sql.includes(bad)) return { ok: false, reason: `banned sequence ${bad}` };
  }

  const lexed = lex(sql);
  if (!Array.isArray(lexed)) return { ok: false, reason: lexed.error };
  const toks = lexed;
  if (!toks.length) return { ok: false, reason: "no tokens" };

  // 1. Single statement, read-only verb.
  if (toks[0].k !== "id" || (toks[0].lc !== "select" && toks[0].lc !== "with")) {
    return { ok: false, reason: "must start with SELECT or WITH" };
  }

  // 2. Per-token scans: banned keywords (bare only), deny-list (any ident), system catalogues.
  for (const t of toks) {
    if (t.k === "id" && BANNED.has(t.lc)) return { ok: false, reason: `banned keyword ${t.lc}` };
    if ((t.k === "id" || t.k === "qid") && DENY_TOKENS.has(t.lc)) return { ok: false, reason: `denied identifier ${t.v}` };
    if ((t.k === "id" || t.k === "qid") && (t.lc.startsWith("pg_") || t.lc === "information_schema")) {
      return { ok: false, reason: `system catalogue ${t.v}` };
    }
  }

  // Declared aliases (table aliases, CTE names, quoted output labels) — needed by checks 3 and 6.
  const aliases = collectAliases(toks);

  // 3. Every quoted identifier must be an allowlisted table/column, or a label the query declared.
  for (const t of toks) {
    if (t.k === "qid" && !ALLOWED_TABLES.has(t.v) && !ALLOWED_COLUMNS.has(t.v) && !aliases.has(t.lc)) {
      return { ok: false, reason: `unknown identifier "${t.v}"` };
    }
  }

  // 4. Every function call must be allowlisted.
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i], next = toks[i + 1];
    if (t.k === "id" && next && next.v === "(" && !CALLABLE.has(t.lc) && !KEYWORDS.has(t.lc)) {
      return { ok: false, reason: `function not allowed: ${t.v}` };
    }
  }

  // 5. Cast targets must be simple scalar types.
  for (let i = 0; i < toks.length - 2; i++) {
    if (toks[i].v === ":" && toks[i + 1].v === ":") {
      const target = toks[i + 2];
      if (!target || target.k !== "id" || !CAST_TYPES.has(target.lc)) return { ok: false, reason: "bad cast target" };
    }
  }

  // 6. Every bare identifier must be a keyword, callable, cast type, declared alias, or column.
  for (const t of toks) {
    if (t.k !== "id") continue;
    if (KEYWORDS.has(t.lc) || CALLABLE.has(t.lc) || CAST_TYPES.has(t.lc)) continue;
    if (aliases.has(t.lc) || ALLOWED_LC.has(t.lc)) continue;
    return { ok: false, reason: `unknown bare identifier ${t.v}` };
  }

  // 7. Must actually touch a real table (no pure-function probes).
  if (!toks.some((t) => t.k === "qid" && ALLOWED_TABLES.has(t.v))) {
    return { ok: false, reason: "no allowlisted table referenced" };
  }

  return { ok: true, sql: withRowCap(sql, toks) };
}
