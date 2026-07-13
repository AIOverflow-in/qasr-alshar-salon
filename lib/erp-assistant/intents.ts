// Pure, dependency-free catalogue of the ONLY questions the ERP assistant can
// answer. Unit-tested in intents.test.ts. The AI never writes SQL — it may only
// pick one of these intent ids and supply parameters, which validatePlan() then
// whitelists and clamps before any query runs. This is the security boundary:
// anything not expressible here simply cannot be asked of the database.

export type IntentId =
  | "takings"
  | "top_services"
  | "top_products"
  | "staff_performance"
  | "low_stock"
  | "expenses_summary"
  | "bookings_summary"
  | "top_clients";

export type IntentDef = {
  id: IntentId;
  label: string;
  /** Plain-English description shown to the planner LLM so it can map questions. */
  desc: string;
  usesRange: boolean;
  usesLimit: boolean;
};

export const INTENTS: IntentDef[] = [
  { id: "takings", label: "Takings", desc: "Sales takings / revenue / money taken (and VAT collected) for a period, split by cash/card/transfer.", usesRange: true, usesLimit: false },
  { id: "top_services", label: "Top services", desc: "Best-selling or most popular services for a period.", usesRange: true, usesLimit: true },
  { id: "top_products", label: "Top products", desc: "Best-selling retail products for a period.", usesRange: true, usesLimit: true },
  { id: "staff_performance", label: "Staff performance", desc: "Each artist's service revenue and commission for a period (who performed best).", usesRange: true, usesLimit: false },
  { id: "low_stock", label: "Low stock", desc: "Products at or below their reorder level that need restocking.", usesRange: false, usesLimit: false },
  { id: "expenses_summary", label: "Expenses", desc: "Expenses for a period, broken down by category.", usesRange: true, usesLimit: false },
  { id: "bookings_summary", label: "Bookings", desc: "Bookings for a period by status (confirmed/completed/cancelled/no-show), plus how many are upcoming.", usesRange: true, usesLimit: false },
  { id: "top_clients", label: "Top clients", desc: "Highest-spending clients.", usesRange: false, usesLimit: true },
];

const BY_ID = new Map(INTENTS.map((i) => [i.id, i]));

/** The named time windows the planner may use (resolved by lib/finance.ts salesRange). */
export const RANGES = ["today", "yesterday", "week", "month", "3m"] as const;

export type RangeParams = { range?: string; from?: string; to?: string; date?: string };

/** Catalogue rendered for the planner prompt. */
export function catalogPromptText(): string {
  return INTENTS.map((i) => `- ${i.id}: ${i.desc}${i.usesLimit ? " (supports a limit/top-N)" : ""}`).join("\n");
}

export type Plan =
  | { kind: "query"; intent: IntentId; params: { range: RangeParams; limit: number } }
  | { kind: "clarify"; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const CLARIFY_FALLBACK =
  "I can tell you about takings, top services or products, staff performance, low stock, expenses, bookings and top clients. Try asking one of those.";

/**
 * Turn a raw planner object (or a direct structured request) into a safe plan.
 * Unknown intents and malformed params never reach the database — they collapse
 * to a friendly clarify. Ranges are whitelisted; limits are clamped to 1..20.
 */
export function validatePlan(raw: unknown): Plan {
  const o = (raw ?? {}) as Record<string, unknown>;

  if (typeof o.clarify === "string" && o.clarify.trim()) {
    return { kind: "clarify", message: o.clarify.trim().slice(0, 300) };
  }

  const id = typeof o.intent === "string" ? o.intent.trim() : "";
  const def = BY_ID.get(id as IntentId);
  if (!def) return { kind: "clarify", message: CLARIFY_FALLBACK };

  const range: RangeParams = {};
  if (def.usesRange) {
    const from = typeof o.from === "string" ? o.from : "";
    const to = typeof o.to === "string" ? o.to : "";
    const date = typeof o.date === "string" ? o.date : "";
    const named = typeof o.range === "string" ? o.range : "";
    if (DATE_RE.test(from) && DATE_RE.test(to)) {
      range.from = from;
      range.to = to;
    } else if (DATE_RE.test(date)) {
      range.date = date;
    } else if ((RANGES as readonly string[]).includes(named)) {
      range.range = named;
    } else {
      range.range = "today";
    }
  }

  let limit = DEFAULT_LIMIT;
  if (def.usesLimit) {
    const n = Number(o.limit);
    if (Number.isFinite(n)) limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(n)));
  }

  return { kind: "query", intent: def.id, params: { range, limit } };
}
