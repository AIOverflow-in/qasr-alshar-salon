// Pure formatting of free-form query rows into the assistant's written answer.
// Same rule as format.ts: figures are rendered here in code from the real rows, never phrased by
// the LLM, so a number can never be hallucinated. Output is the light markdown the panel renders
// (**bold** + newlines). Deliberately simple — a heading, then either one value or a short list.
import { aed } from "../utils";
import { columnKind } from "./schema-card";

const MAX_LIST_ROWS = 25;
const MAX_ANSWER_CHARS = 1800;

/** Pretty column label: "totalAED" → "Total", "staff_name" → "Staff name". */
export function labelFor(key: string): string {
  const base = key.replace(/AED$/i, "").replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  const s = base || key;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function isMoneyKey(key: string): boolean {
  if (columnKind(key) === "aed") return true;
  return /aed$/i.test(key) || /^(total|amount|salary|spent|revenue|net|gross|commission|sales|profit|cost|price)/i.test(key);
}

function isDateish(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T|$)/.test(v);
}

/** Format one cell for display. */
export function formatValue(key: string, v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") {
    if (isMoneyKey(key)) return aed(Math.round(v));
    return Number.isInteger(v) ? v.toLocaleString("en-AE") : v.toLocaleString("en-AE", { maximumFractionDigits: 2 });
  }
  if (isDateish(v)) {
    const d = new Date(v.length === 10 ? `${v}T00:00:00Z` : v);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" }).format(d);
    }
  }
  const s = String(v);
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

/** Rows → a short, plain answer. Heading comes from the model; every number comes from the data. */
export function formatRows(title: string, rows: Record<string, unknown>[], truncated = false): string {
  const heading = (title || "Result").trim().slice(0, 80);
  if (!rows.length) return `**${heading}:** no matching records.`;

  const keys = Object.keys(rows[0] ?? {});

  // Single number — the most common shape ("how much did I make in June?").
  if (rows.length === 1 && keys.length === 1) {
    return `**${heading}:** ${formatValue(keys[0], rows[0][keys[0]])}`;
  }

  // One record — show its fields as bullets.
  if (rows.length === 1) {
    const lines = keys.map((k) => `• ${labelFor(k)} — ${formatValue(k, rows[0][k])}`);
    return clip([`**${heading}**`, ...lines].join("\n"));
  }

  // Several records — numbered list, first column is the label.
  const [labelKey, ...rest] = keys;
  const shown = rows.slice(0, MAX_LIST_ROWS);
  const lines = shown.map((r, i) => {
    const head = formatValue(labelKey, r[labelKey]);
    const tail = rest.map((k) => `${labelFor(k)}: ${formatValue(k, r[k])}`).join(" · ");
    return `${i + 1}. **${head}**${tail ? ` — ${tail}` : ""}`;
  });
  const more = truncated || rows.length > shown.length ? `\n_(showing the first ${shown.length})_` : "";
  return clip([`**${heading}**`, ...lines].join("\n") + more);
}

function clip(s: string): string {
  return s.length > MAX_ANSWER_CHARS ? `${s.slice(0, MAX_ANSWER_CHARS)}…` : s;
}
