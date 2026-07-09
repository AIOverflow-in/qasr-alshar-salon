import { test } from "node:test";
import assert from "node:assert/strict";
import { NOTIFY_EMAILS, DIGEST_EMAILS } from "./notify-core.ts";

test("operational notifications go to exactly admin + aioverflow", () => {
  assert.deepEqual(
    [...NOTIFY_EMAILS].sort(),
    ["admin@qasralsharsalon.com", "aioverflow.ml@gmail.com"],
  );
});

test("Jacqueline stays off operational alerts (bookings/shop/reminders)", () => {
  assert.ok(!NOTIFY_EMAILS.includes("jacquelineekumba2010@gmail.com"));
});

test("daily takings digest also goes to Jacqueline", () => {
  assert.deepEqual(
    [...DIGEST_EMAILS].sort(),
    ["admin@qasralsharsalon.com", "aioverflow.ml@gmail.com", "jacquelineekumba2010@gmail.com"],
  );
});

test("no personal address ever receives any notification", () => {
  for (const list of [NOTIFY_EMAILS, DIGEST_EMAILS]) {
    for (const bad of ["achethanreddy1921@gmail.com", "chethan@staple.io", "chethanreddy1921@gmail.com"]) {
      assert.ok(!list.includes(bad), `${bad} must not be a notification recipient`);
    }
  }
});
