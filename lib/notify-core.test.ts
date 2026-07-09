import { test } from "node:test";
import assert from "node:assert/strict";
import { NOTIFY_EMAILS } from "./notify-core.ts";

test("owner notifications go to exactly the three intended addresses", () => {
  assert.deepEqual(
    [...NOTIFY_EMAILS].sort(),
    ["admin@qasralsharsalon.com", "aioverflow.ml@gmail.com", "jacquelineekumba2010@gmail.com"],
  );
});

test("no personal address ever receives notifications", () => {
  for (const bad of ["achethanreddy1921@gmail.com", "chethan@staple.io", "chethanreddy1921@gmail.com"]) {
    assert.ok(!NOTIFY_EMAILS.includes(bad), `${bad} must not be a notification recipient`);
  }
});
