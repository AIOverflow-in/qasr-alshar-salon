import { test } from "node:test";
import assert from "node:assert/strict";
import { NOTIFY_EMAILS } from "./notify-core.ts";

test("owner notifications go to exactly admin + aioverflow", () => {
  assert.deepEqual(
    [...NOTIFY_EMAILS].sort(),
    ["admin@qasralsharsalon.com", "aioverflow.ml@gmail.com"],
  );
});

test("excluded addresses never receive notifications", () => {
  // Jacqueline was removed per owner request; personal addresses never included.
  for (const bad of ["jacquelineekumba2010@gmail.com", "achethanreddy1921@gmail.com", "chethan@staple.io", "chethanreddy1921@gmail.com"]) {
    assert.ok(!NOTIFY_EMAILS.includes(bad), `${bad} must not be a notification recipient`);
  }
});
