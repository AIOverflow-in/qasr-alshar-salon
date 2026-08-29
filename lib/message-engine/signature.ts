import { createHmac, timingSafeEqual } from "node:crypto";

export function validateTwilioSignature(url: string, params: Record<string, string>, signature: string | null, authToken: string) {
  if (!signature || !authToken) return false;
  const data = url + Object.keys(params).sort().map((key) => key + params[key]).join("");
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
