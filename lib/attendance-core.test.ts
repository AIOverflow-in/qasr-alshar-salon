import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAttlog, handshakeResponse } from "./attendance-core.ts";

test("parseAttlog parses tab-separated ATTLOG records", () => {
  const body = "12\t2026-07-08 10:03:15\t0\t1\t0\n7\t2026-07-08 18:31:00\t1\t1\t0";
  const r = parseAttlog(body);
  assert.equal(r.length, 2);
  assert.equal(r[0].pin, "12");
  assert.equal(r[0].status, "0");
  assert.equal(r[0].verifyMode, "1");
  // 10:03:15 Dubai (+04:00) == 06:03:15 UTC
  assert.equal(r[0].punchedAt.toISOString(), "2026-07-08T06:03:15.000Z");
  assert.equal(r[1].pin, "7");
});

test("parseAttlog tolerates CRLF, blank lines and short/garbled lines", () => {
  const body = "\r\n5\t2026-07-08 09:00:00\t0\t1\r\n\r\ngarbage-no-tab\r\nX\tnot-a-date\t0\r\n9\t2026-07-08 09:05:00\r\n";
  const r = parseAttlog(body);
  // valid: pin 5 (full) + pin 9 (no status/verify). "garbage" and bad-date skipped.
  assert.deepEqual(r.map((p) => p.pin), ["5", "9"]);
  assert.equal(r[1].status, null);
  assert.equal(r[1].verifyMode, null);
});

test("parseAttlog never throws on empty / junk input", () => {
  assert.deepEqual(parseAttlog(""), []);
  assert.deepEqual(parseAttlog("   \n\n"), []);
  assert.deepEqual(parseAttlog(undefined as unknown as string), []);
});

test("handshakeResponse carries the SN + enables realtime push", () => {
  const h = handshakeResponse("BZD5235200204");
  assert.match(h, /GET OPTION FROM: BZD5235200204/);
  assert.match(h, /Realtime=1/);
  assert.match(h, /Stamp=/);
});
