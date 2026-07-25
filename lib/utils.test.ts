import { test } from "node:test";
import assert from "node:assert/strict";
import { cn, normalizePhoneIntl, whatsappLink, aed, slugify } from "./utils";

test("cn merges classes and resolves Tailwind conflicts", () => {
  assert.equal(cn("a", "b"), "a b");
  assert.equal(cn("px-2", "px-4"), "px-4"); // twMerge: later wins
  assert.equal(cn("text-sm", false && "hidden", null, undefined, "font-bold"), "text-sm font-bold");
});

test("normalizePhoneIntl maps UAE local formats to wa.me digits", () => {
  assert.equal(normalizePhoneIntl("0501193606"), "971501193606");   // local trunk 0
  assert.equal(normalizePhoneIntl("00971501193606"), "971501193606"); // intl 00 prefix
  assert.equal(normalizePhoneIntl("971501193606"), "971501193606");  // already this country
  assert.equal(normalizePhoneIntl("501193606"), "971501193606");     // bare subscriber number
  assert.equal(normalizePhoneIntl("+971 50 119 3606"), "971501193606"); // punctuation stripped
});

test("normalizePhoneIntl keeps other-country international numbers as-is", () => {
  assert.equal(normalizePhoneIntl("233201234567"), "233201234567"); // Ghana, already international
  assert.equal(normalizePhoneIntl(""), "");
  assert.equal(normalizePhoneIntl("---"), ""); // no digits
});

test("whatsappLink builds a wa.me deep link, encoding the message", () => {
  assert.equal(whatsappLink("0501193606"), "https://wa.me/971501193606");
  assert.equal(whatsappLink("0501193606", "Hi there!"), "https://wa.me/971501193606?text=Hi%20there!");
});

test("aed formats with a currency prefix, thousands separator, and optional plus", () => {
  assert.equal(aed(0), "AED 0");
  assert.equal(aed(500), "AED 500");
  assert.equal(aed(1200), "AED 1,200");
  assert.equal(aed(1234567), "AED 1,234,567");
  assert.equal(aed(1200, true), "AED 1,200+");
  assert.equal(aed(50, true), "AED 50+");
});

test("slugify produces clean URL slugs", () => {
  assert.equal(slugify("Box Braids"), "box-braids");
  assert.equal(slugify("  Deep Conditioning Treatment  "), "deep-conditioning-treatment");
  assert.equal(slugify("Knotless Braids (Medium)"), "knotless-braids-medium");
  assert.equal(slugify("A_B-C"), "a-b-c");        // underscores/dashes collapse
  assert.equal(slugify("--Trim--"), "trim");      // leading/trailing dashes stripped
  assert.equal(slugify("Multiple   Spaces"), "multiple-spaces");
});
