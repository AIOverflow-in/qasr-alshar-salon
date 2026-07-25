import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCell, matchStaff, buildStaffUpdate } from "./staff-import-core.ts";

const STAFF = [
  { id: "s1", name: "Kadiatu Kamara" },
  { id: "s2", name: "Sarah Gatibaro" },
  { id: "s3", name: "Sarah Ngigi" },
  { id: "s4", name: "Ann Wanjiro" },
  { id: "s5", name: "Rahinatu Kubi" },
];

test("cleanCell strips blanks, dashes and N/A, collapses whitespace", () => {
  assert.equal(cleanCell(""), null);
  assert.equal(cleanCell("  -  "), null);
  assert.equal(cleanCell("N/A"), null);
  assert.equal(cleanCell("n/a"), null);
  assert.equal(cleanCell("NA"), null);
  assert.equal(cleanCell("  AK1808572 "), "AK1808572");
  assert.equal(cleanCell("RAHINATU  KUBI"), "RAHINATU KUBI");
  assert.equal(cleanCell(null), null);
});

test("matchStaff resolves exact and unique multi-token names", () => {
  assert.deepEqual(matchStaff(STAFF, "KADIATU KAMARA"), { id: "s1" });
  assert.deepEqual(matchStaff(STAFF, "sarah gatibaro"), { id: "s2" });
  assert.deepEqual(matchStaff(STAFF, "RAHINATU  KUBI"), { id: "s5" }); // double space tolerated
});

test("matchStaff refuses to guess ambiguous or missing rows", () => {
  // the stray single-token "KAMARA" must NOT map onto Kadiatu
  assert.ok("skip" in matchStaff(STAFF, "KAMARA"));
  assert.ok("skip" in matchStaff(STAFF, "ANN"));           // single token
  assert.ok("skip" in matchStaff(STAFF, "WINFRIDA OHALLA AGATA")); // no such staff
});

test("matchStaff skips when multiple staff share the tokens", () => {
  const r = matchStaff([{ id: "a", name: "Sarah Gatibaro" }, { id: "b", name: "Sarah Ngigi" }], "Sarah");
  assert.ok("skip" in r); // single token anyway, but must not pick one
});

test("buildStaffUpdate maps contact->phone and drops empty cells", () => {
  const data = buildStaffUpdate({
    name: "X", contact: "0551234567", passportNumber: "AK1", passportExpiry: "N/A",
    emiratesId: "", emergencyContact: "254700000000", emergencyRelationship: "SISTER",
  });
  assert.deepEqual(data, {
    phone: "0551234567", passportNumber: "AK1", emergencyContact: "254700000000", emergencyRelationship: "SISTER",
  });
  assert.deepEqual(buildStaffUpdate({ name: "Y" }), {}); // nothing to set
});
