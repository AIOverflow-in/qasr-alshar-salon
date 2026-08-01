import "server-only";
import { getAssistantProvider } from "../ai";
import { validatePlan, catalogPromptText, type Plan } from "./intents";
import { runIntent } from "./run";
import { formatAnswer } from "./format";
import { schemaCardText } from "./schema-card";
import { validateSql } from "./sql-guard";
import { runReadOnlySql } from "./sql-run";
import { formatRows } from "./sql-format";
import { getCachedSql, rememberSql, recordClarify } from "./sql-cache";

export type AssistantInput =
  | { question: string }
  | { intent: string; params?: Record<string, unknown> };

export type AssistantAnswer = { answer: string; intent: string | null; data?: unknown };

const CANT_ANSWER =
  "I couldn't work that one out. Try asking it a slightly different way — for example naming the month or the artist.";
const TOO_BIG = "That's a heavy one to work out. Try narrowing it to a single month or a shorter list.";

/**
 * The system prompt. MUST stay byte-identical across requests: OpenAI's automatic prompt caching
 * matches the longest common prefix, so anything varying (the date!) belongs in the user message.
 * With the date inlined here the cache could never hit — that was worth ~35% of the bill.
 */
const SYSTEM_PROMPT = `You answer a salon manager's questions about her ERP database. Reply with ONE JSON object, nothing else.

Prefer a ready-made query when one fits:
${catalogPromptText()}
→ {"intent":"<id>","range":"today"|"yesterday"|"week"|"month"|"3m","from":"YYYY-MM-DD","to":"YYYY-MM-DD","date":"YYYY-MM-DD","limit":<n>}
(range/from/to/date/limit are optional; use from+to for a named month, e.g. June 2026 → 2026-06-01..2026-06-30)

Otherwise write ONE read-only PostgreSQL SELECT:
→ {"sql":"SELECT ...","title":"<short heading, max 8 words>"}

If the question is not about this salon's data, or you cannot answer it from these tables:
→ {"clarify":"<one short sentence>"}

TABLES (exact names, always double-quote identifiers — they are case-sensitive):
${schemaCardText()}

SQL RULES — a query breaking any of these is rejected:
- SELECT or WITH only. One statement. No semicolon, no comments, no ";", "$", "--", "/*".
- Only the tables and columns listed above. Nothing else exists.
- Every table/column identifier must be double-quoted: "SalesOrder"."totalAED".
- Money columns are INTEGER AED (no decimals). Revenue = "SalesOrder" rows with "status"='PAID', by "createdAt".
- Expenses are counted by "incurredOn". Payroll/commission months are text 'YYYY-MM'.
- Dubai is UTC+4: bucket days with ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Dubai').
- Always aggregate or LIMIT — never return a whole table.
- Give computed columns a clear alias, e.g. AS "totalAED" for money so it formats as currency.

EXAMPLES
Q: how many clients came back more than twice in June?
{"sql":"SELECT count(*)::int AS clients FROM (SELECT \\"clientId\\" FROM \\"SalesOrder\\" WHERE \\"status\\"='PAID' AND \\"createdAt\\" >= '2026-06-01' AND \\"createdAt\\" < '2026-07-01' AND \\"clientId\\" IS NOT NULL GROUP BY \\"clientId\\" HAVING count(*) > 2) q","title":"Repeat clients in June"}
Q: which artist earns the most per client?
{"sql":"SELECT s.\\"name\\" AS artist, round(sum(c.\\"amountAED\\") / greatest(count(DISTINCT o.\\"clientId\\"),1)) AS \\"perClientAED\\" FROM \\"Commission\\" c JOIN \\"Staff\\" s ON s.\\"id\\"=c.\\"staffId\\" JOIN \\"SalesOrder\\" o ON o.\\"id\\"=c.\\"orderId\\" GROUP BY s.\\"name\\" ORDER BY \\"perClientAED\\" DESC LIMIT 10","title":"Earnings per client by artist"}
Q: what's the weather today?
{"clarify":"I can only answer questions about the salon's own data — sales, bookings, staff, stock, expenses and clients."}`;

type Ask =
  | { kind: "sql"; sql: string; title: string }
  | Plan;

/**
 * Validate whatever the model returned. SQL goes through the guard; anything else falls back to
 * the existing intent boundary, so the catalogue path is completely unchanged.
 */
function validateAsk(raw: unknown): Ask {
  const o = (raw ?? {}) as Record<string, unknown>;
  if (typeof o.sql === "string" && o.sql.trim()) {
    if (process.env.ASSISTANT_SQL_TIER === "0") return { kind: "clarify", message: CANT_ANSWER }; // kill switch
    const checked = validateSql(o.sql);
    if (!checked.ok) {
      console.warn("[assistant] SQL rejected:", checked.reason, "|", o.sql);
      return { kind: "clarify", message: CANT_ANSWER };
    }
    const title = (typeof o.title === "string" ? o.title.trim().slice(0, 80) : "") || "Result";
    return { kind: "sql", sql: checked.sql, title };
  }
  return validatePlan(o);
}

/** Ask the model to turn the question into an intent, SQL, or a clarification. */
async function planFromQuestion(question: string): Promise<Ask> {
  const provider = getAssistantProvider();
  if (!provider) return { kind: "clarify", message: "The assistant isn't set up yet (no AI key configured)." };

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  let raw: string;
  try {
    raw = await provider.generateJSON(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Today in Dubai is ${today}.\n${question}` },
      ],
      { temperature: 0, maxTokens: 600, timeoutMs: 12_000 },
    );
  } catch (e) {
    console.error("[assistant] planner call failed:", e);
    return { kind: "clarify", message: "I couldn't reach the assistant just now — please try again." };
  }

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  return validateAsk(parsed);
}

/** Run validated SQL and turn the rows into an answer. */
async function answerFromSql(sql: string, title: string): Promise<AssistantAnswer> {
  const res = await runReadOnlySql(sql);
  if (!res.ok) return { answer: res.kind === "timeout" ? TOO_BIG : CANT_ANSWER, intent: null };
  return {
    answer: formatRows(title, res.rows, res.truncated),
    intent: "sql",
    data: { rows: res.rows, truncated: res.truncated },
  };
}

/**
 * Answer an assistant request. Two entry shapes:
 *  - { question } — natural language; the model plans (intent OR SQL), then we run + format.
 *  - { intent, params } — a direct structured query (tests / structured UI); skips the LLM.
 *
 * SECURITY: the structured entry goes straight to validatePlan, never to validateAsk — so no HTTP
 * client can hand us SQL. Only a model-written plan can ever reach the SQL tier.
 */
export async function answerAssistant(input: AssistantInput): Promise<AssistantAnswer> {
  if (!("question" in input)) {
    const plan = validatePlan({ intent: input.intent, ...(input.params ?? {}) });
    if (plan.kind === "clarify") return { answer: plan.message, intent: null };
    const data = await runIntent(plan.intent, plan.params);
    return { answer: formatAnswer(plan.intent, data), intent: plan.intent, data };
  }

  // Repeat questions reuse the remembered SQL: no LLM call, but the query re-runs for fresh numbers.
  const cached = await getCachedSql(input.question);
  if (cached) return answerFromSql(cached.sql, cached.title);

  const ask = await planFromQuestion(input.question);

  if (ask.kind === "sql") {
    await rememberSql(input.question, ask.sql, ask.title);
    return answerFromSql(ask.sql, ask.title);
  }
  if (ask.kind === "clarify") {
    await recordClarify(input.question);
    return { answer: ask.message, intent: null };
  }

  const data = await runIntent(ask.intent, ask.params);
  return { answer: formatAnswer(ask.intent, data), intent: ask.intent, data };
}
