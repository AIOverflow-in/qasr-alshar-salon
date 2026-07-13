import "server-only";
import { getTextProvider } from "../ai";
import { validatePlan, catalogPromptText, type Plan } from "./intents";
import { runIntent } from "./run";
import { formatAnswer } from "./format";

export type AssistantInput =
  | { question: string }
  | { intent: string; params?: Record<string, unknown> };

export type AssistantAnswer = { answer: string; intent: string | null; data?: unknown };

/** Ask the planner LLM to map a natural-language question onto one catalogue intent. */
async function planFromQuestion(question: string): Promise<Plan> {
  const provider = getTextProvider();
  if (!provider) return { kind: "clarify", message: "The assistant isn't set up yet (no AI key configured)." };

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const system = `You turn a salon manager's question into ONE structured data query for our ERP. Today in Dubai is ${today}.

Available queries:
${catalogPromptText()}

Return ONLY JSON with these keys:
{"intent": "<exactly one id from the list>",
 "range": "today" | "yesterday" | "week" | "month" | "3m"   (optional named window),
 "from": "YYYY-MM-DD", "to": "YYYY-MM-DD"                     (optional explicit range — use for a named month, e.g. June 2026 -> from 2026-06-01 to 2026-06-30),
 "date": "YYYY-MM-DD"                                          (optional single day),
 "limit": <number>                                            (optional, for top-N queries)}

Pick the single best intent. If the question cannot be answered by any of these queries, instead return {"clarify": "<one short sentence saying what you can answer>"}. Do not invent intents or data.`;

  let raw: string;
  try {
    raw = await provider.generateJSON([{ role: "system", content: system }, { role: "user", content: question }], { temperature: 0 });
  } catch (e) {
    console.error("[assistant] planner call failed:", e);
    return { kind: "clarify", message: "I couldn't reach the assistant just now — please try again." };
  }

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  return validatePlan(parsed);
}

/**
 * Answer an assistant request. Two entry shapes:
 *  - { question } — natural language; the LLM plans, then we run + format.
 *  - { intent, params } — a direct structured query (used by tests / structured UI);
 *    skips the LLM entirely. Both go through validatePlan, so both are equally safe.
 */
export async function answerAssistant(input: AssistantInput): Promise<AssistantAnswer> {
  const plan = "question" in input
    ? await planFromQuestion(input.question)
    : validatePlan({ intent: input.intent, ...(input.params ?? {}) });

  if (plan.kind === "clarify") return { answer: plan.message, intent: null };

  const data = await runIntent(plan.intent, plan.params);
  return { answer: formatAnswer(plan.intent, data), intent: plan.intent, data };
}
