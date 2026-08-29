import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { normalizeE164 } from "./message-engine/normalize";
import { validateTwilioSignature } from "./message-engine/signature";

test("message engine normalizes UAE local and international numbers", () => {
  assert.equal(normalizeE164("050 123 4567"), "+971501234567");
  assert.equal(normalizeE164("+971 50 123 4567"), "+971501234567");
  assert.equal(normalizeE164("not-a-number"), null);
});

test("message engine validates Twilio signatures and rejects changes", () => {
  const url = "https://example.test/api/webhooks/twilio/status";
  const params = { MessageSid: "SM123", MessageStatus: "delivered" };
  const token = "test-auth-token";
  const data = url + Object.keys(params).sort().map((key) => key + params[key as keyof typeof params]).join("");
  const signature = createHmac("sha1", token).update(data).digest("base64");
  assert.equal(validateTwilioSignature(url, params, signature, token), true);
  assert.equal(validateTwilioSignature(url, { ...params, MessageStatus: "failed" }, signature, token), false);
});
