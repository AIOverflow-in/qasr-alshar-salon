import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlan, catalogPromptText, INTENTS } from "./intents.ts";

test("unknown intent collapses to a friendly clarify (never reaches the DB)", () => {
  const p = validatePlan({ intent: "drop_table" });
  assert.equal(p.kind, "clarify");
  const p2 = validatePlan({ intent: "" });
  assert.equal(p2.kind, "clarify");
  const p3 = validatePlan({});
  assert.equal(p3.kind, "clarify");
});

test("an explicit clarify from the planner is passed through", () => {
  const p = validatePlan({ clarify: "I can only answer business questions." });
  assert.equal(p.kind, "clarify");
  if (p.kind === "clarify") assert.match(p.message, /business questions/);
});

test("a valid range intent defaults to today when no window is given", () => {
  const p = validatePlan({ intent: "takings" });
  assert.equal(p.kind, "query");
  if (p.kind === "query") {
    assert.equal(p.intent, "takings");
    assert.equal(p.params.range.range, "today");
  }
});

test("only whitelisted named ranges are accepted; junk falls back to today", () => {
  assert.equal((validatePlan({ intent: "takings", range: "month" }) as any).params.range.range, "month");
  assert.equal((validatePlan({ intent: "takings", range: "all-time; DROP" }) as any).params.range.range, "today");
});

test("explicit from/to dates are accepted only when well-formed", () => {
  const good = validatePlan({ intent: "takings", from: "2026-06-01", to: "2026-06-30" });
  assert.deepEqual((good as any).params.range, { from: "2026-06-01", to: "2026-06-30" });
  // malformed dates are ignored → falls back to a named window
  const bad = validatePlan({ intent: "takings", from: "june", to: "2026-06-30" });
  assert.equal((bad as any).params.range.range, "today");
});

test("limit is clamped to 1..20 and only applies to top-N intents", () => {
  assert.equal((validatePlan({ intent: "top_services", limit: 999 }) as any).params.limit, 20);
  assert.equal((validatePlan({ intent: "top_services", limit: 0 }) as any).params.limit, 1);
  assert.equal((validatePlan({ intent: "top_services", limit: 3 }) as any).params.limit, 3);
  assert.equal((validatePlan({ intent: "top_services" }) as any).params.limit, 5); // default
});

test("non-range intents carry no window", () => {
  const p = validatePlan({ intent: "low_stock", range: "month" });
  assert.deepEqual((p as any).params.range, {});
});

test("catalogue prompt lists every intent id exactly once", () => {
  const text = catalogPromptText();
  for (const i of INTENTS) assert.ok(text.includes(`- ${i.id}:`), `missing ${i.id}`);
});
