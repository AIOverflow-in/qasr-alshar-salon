import { test } from "node:test";
import assert from "node:assert/strict";
import { serviceListText, clientBookingMessage, salonToClientMessage, artistReminderMessage } from "./booking-format";

test("serviceListText joins non-empty names with commas", () => {
  assert.equal(serviceListText(["Box Braids", "Deep Conditioning", "Henna"]), "Box Braids, Deep Conditioning, Henna");
  assert.equal(serviceListText(["A", "", "B"]), "A, B"); // blanks dropped
  assert.equal(serviceListText([]), "");
});

test("clientBookingMessage includes ref, bulleted services, and when", () => {
  const m = clientBookingMessage({ services: ["Box Braids", "Henna"], whenLabel: "Sat 26 Jul, 2pm", ref: "QA-1001" });
  assert.match(m, /ref QA-1001/);
  assert.match(m, /• Box Braids/);
  assert.match(m, /• Henna/);
  assert.match(m, /When: Sat 26 Jul, 2pm/);
});

test("clientBookingMessage omits the ref clause when absent", () => {
  const m = clientBookingMessage({ services: ["Box Braids"], whenLabel: "today" });
  assert.doesNotMatch(m, /ref/);
});

test("salonToClientMessage: salon vs home location line", () => {
  const salon = salonToClientMessage({ customerName: "Aisha", services: ["Makeup"], whenLabel: "Fri 3pm" });
  assert.match(salon, /Hello Aisha/);
  assert.match(salon, /confirmed/);
  assert.match(salon, /At the salon/);

  const home = salonToClientMessage({ customerName: "Mariam", services: ["Makeup"], whenLabel: "Fri 3pm", serviceMode: "HOME", address: "Villa 5, Jumeirah" });
  assert.match(home, /Home service — Villa 5, Jumeirah/);

  const homeNoAddr = salonToClientMessage({ customerName: "Mariam", services: ["Makeup"], whenLabel: "Fri 3pm", serviceMode: "HOME" });
  assert.match(homeNoAddr, /Home service(?! —)/); // no dangling em-dash without an address
});

test("artistReminderMessage names the artist, client, services, and when", () => {
  const m = artistReminderMessage({ artistName: "Grace", customerName: "Aisha", services: ["Cornrows"], whenLabel: "Sun 11am" });
  assert.match(m, /Hi Grace/);
  assert.match(m, /Client: Aisha/);
  assert.match(m, /• Cornrows/);
  assert.match(m, /When: Sun 11am/);
  assert.match(m, /At the salon/);
});
