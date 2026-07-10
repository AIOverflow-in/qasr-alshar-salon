import { test } from "node:test";
import assert from "node:assert/strict";
import { pickProvider, resolveModel, SUPPORTED_TEXT_PROVIDERS } from "./select.ts";

test("pickProvider returns a supported value as-is (case/space-insensitive)", () => {
  assert.equal(pickProvider("openai", SUPPORTED_TEXT_PROVIDERS), "openai");
  assert.equal(pickProvider(" OpenAI ", SUPPORTED_TEXT_PROVIDERS), "openai");
});

test("pickProvider falls back to default on unknown/empty/undefined", () => {
  assert.equal(pickProvider("anthropic", SUPPORTED_TEXT_PROVIDERS), "openai"); // not wired yet → default
  assert.equal(pickProvider("", SUPPORTED_TEXT_PROVIDERS), "openai");
  assert.equal(pickProvider(undefined, SUPPORTED_TEXT_PROVIDERS), "openai");
  assert.equal(pickProvider("typo", ["openai", "glm"], "glm"), "glm"); // explicit fallback honoured
});

test("resolveModel prefers the generic var, then legacy, then the hard default", () => {
  assert.equal(resolveModel("gpt-5", "gpt-4.1", "gpt-4o"), "gpt-5");
  assert.equal(resolveModel(undefined, "gpt-4.1", "gpt-4o"), "gpt-4.1"); // backward-compat with old env
  assert.equal(resolveModel("  ", "  ", "gpt-4o"), "gpt-4o");
});
