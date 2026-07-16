import { test } from "node:test";
import assert from "node:assert/strict";
import { stripEmDashes } from "./blog-content-core.ts";

test("em-dashes between words become commas", () => {
  assert.equal(stripEmDashes("Knotless braids — the gentle choice"), "Knotless braids, the gentle choice");
  assert.equal(stripEmDashes("gentle—precise—modern"), "gentle, precise, modern");
});

test("numeric hyphen ranges and list markers are untouched", () => {
  assert.equal(stripEmDashes("They last 6-8 weeks"), "They last 6-8 weeks");
  assert.equal(stripEmDashes("- one\n- two"), "- one\n- two");
});

test("no leftover double commas or stray spaces before punctuation", () => {
  assert.doesNotMatch(stripEmDashes("care — , after"), /,\s*,/);
  assert.equal(stripEmDashes("done —."), "done.");
  assert.equal(stripEmDashes("word —word"), "word, word");
});

test("plain text and empty input pass through cleanly", () => {
  assert.equal(stripEmDashes("Just normal, human copy."), "Just normal, human copy.");
  assert.equal(stripEmDashes(""), "");
  assert.equal(stripEmDashes(undefined as unknown as string), "");
});
