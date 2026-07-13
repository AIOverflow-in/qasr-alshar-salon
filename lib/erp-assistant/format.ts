// Pure formatting of a query result into the assistant's written answer.
// Unit-tested in format.test.ts. Deterministic on purpose: the answer is built
// from the real query numbers here in code, never phrased by the LLM, so figures
// can never be hallucinated or drift from the ERP.
import { aed } from "../utils";
import type { IntentId, RangeParams } from "./intents";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Human label for a resolved window ("today", "this month", "1 Jun – 30 Jun 2026"). */
export function rangeLabel(range?: RangeParams): string {
  if (!range) return "";
  if (range.from && range.to) return `${fmtDate(range.from)} – ${fmtDate(range.to)}`;
  if (range.date) return fmtDate(range.date);
  switch (range.range) {
    case "yesterday": return "yesterday";
    case "week": return "the last 7 days";
    case "month": return "this month";
    case "3m": return "the last 3 months";
    default: return "today";
  }
}

function titleCase(s: string): string {
  return String(s).toLowerCase().replace(/_/g, " ").replace(/(^|\s)\w/g, (m) => m.toUpperCase());
}

// The shapes below mirror what lib/erp-assistant/run.ts returns per intent.
type Row = Record<string, unknown>;
type Result = {
  window?: RangeParams;
  total?: number; net?: number; vat?: number; count?: number;
  byMethod?: { CASH: number; CARD: number; TRANSFER: number };
  byStatus?: Record<string, number>; upcoming?: number;
  rows?: Row[];
};

/** Build the written answer for a given intent + its query result. */
export function formatAnswer(intent: IntentId, r: Result): string {
  switch (intent) {
    case "takings": {
      const when = rangeLabel(r.window);
      if (!r.count) return `No paid sales ${when}.`;
      const m = r.byMethod ?? { CASH: 0, CARD: 0, TRANSFER: 0 };
      return `**Takings — ${when}:** ${aed(r.total ?? 0)} across ${r.count} bill${r.count === 1 ? "" : "s"} (net ${aed(r.net ?? 0)} + VAT ${aed(r.vat ?? 0)}).\nBy method — Cash ${aed(m.CASH)} · Card ${aed(m.CARD)} · Transfer ${aed(m.TRANSFER)}.`;
    }
    case "top_services":
    case "top_products": {
      const when = rangeLabel(r.window);
      const noun = intent === "top_services" ? "services" : "products";
      const rows = r.rows ?? [];
      if (!rows.length) return `No ${noun} sold ${when}.`;
      const lines = rows.map((x, i) => `${i + 1}. ${x.name} — ${x.qty} sold, ${aed(Number(x.revenue) || 0)}`).join("\n");
      return `**Top ${noun} — ${when}:**\n${lines}`;
    }
    case "staff_performance": {
      const when = rangeLabel(r.window);
      const rows = r.rows ?? [];
      if (!rows.length) return `No artist sales recorded ${when}.`;
      const lines = rows.map((x, i) => `${i + 1}. ${x.name} — ${aed(Number(x.services) || 0)} in services (commission ${aed(Number(x.commission) || 0)})`).join("\n");
      return `**Artist performance — ${when}:**\n${lines}`;
    }
    case "low_stock": {
      const rows = r.rows ?? [];
      if (!rows.length) return "Nothing is low on stock — every product is above its reorder level. 👍";
      const lines = rows.map((x) => `• ${x.name} — ${x.qty} left (reorder at ${x.reorderAt})`).join("\n");
      return `**Low stock (${rows.length}):**\n${lines}`;
    }
    case "expenses_summary": {
      const when = rangeLabel(r.window);
      const rows = r.rows ?? [];
      if (!rows.length) return `No expenses recorded ${when}.`;
      const lines = rows.map((x) => `• ${titleCase(String(x.category))} — ${aed(Number(x.total) || 0)}`).join("\n");
      return `**Expenses — ${when}: ${aed(r.total ?? 0)}**\n${lines}`;
    }
    case "bookings_summary": {
      const when = rangeLabel(r.window);
      const parts = Object.entries(r.byStatus ?? {}).map(([k, v]) => `${titleCase(k)} ${v}`).join(" · ");
      return `**Bookings — ${when}: ${r.total ?? 0}**${parts ? `\n${parts}` : ""}\nUpcoming confirmed: ${r.upcoming ?? 0}.`;
    }
    case "top_clients": {
      const rows = r.rows ?? [];
      if (!rows.length) return "No client spend recorded yet.";
      const lines = rows.map((x, i) => `${i + 1}. ${x.name} — ${aed(Number(x.spent) || 0)} over ${x.visits} visit${x.visits === 1 ? "" : "s"}`).join("\n");
      return `**Top clients:**\n${lines}`;
    }
  }
  return "I couldn't format that result.";
}
