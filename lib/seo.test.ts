import { test } from "node:test";
import assert from "node:assert/strict";
import { pageMeta, localBusinessSchema, breadcrumbSchema, websiteSchema, faqSchema } from "./seo";
import { SITE } from "./site";

test("pageMeta: title is absolute (no double-branding) and canonical matches the path", () => {
  const m = pageMeta({ title: "Braiding Styles in Dubai", description: "Desc", path: "/services/braids" });
  // `absolute` bypasses the layout title.template so the brand isn't appended twice.
  assert.deepEqual(m.title, { absolute: "Braiding Styles in Dubai | Qasr Alshar Salon" });
  assert.equal((m.alternates as any).canonical, `${SITE.url}/services/braids`);
  assert.equal((m.openGraph as any).title, "Braiding Styles in Dubai | Qasr Alshar Salon");
  assert.equal((m.openGraph as any).url, `${SITE.url}/services/braids`);
  assert.equal((m.twitter as any).card, "summary_large_image");
});

test("pageMeta: bare call falls back to the site name + description", () => {
  const m = pageMeta({});
  assert.deepEqual(m.title, { absolute: SITE.name });
  assert.equal(m.description, SITE.description);
  assert.equal((m.alternates as any).canonical, SITE.url); // path defaults to ""
});

test("localBusinessSchema is a valid HairSalon node", () => {
  const s = localBusinessSchema() as any;
  assert.equal(s["@type"], "HairSalon");
  assert.equal(s.name, SITE.name);
  assert.equal(s.address.addressCountry, "AE");
  assert.equal(s.openingHoursSpecification[0].opens, SITE.hours.open);
  assert.equal(typeof s.geo.latitude, "number");
  assert.ok(Array.isArray(s.sameAs) && s.sameAs.length >= 3);
});

test("breadcrumbSchema numbers items from 1 and builds absolute item URLs", () => {
  const s = breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }]) as any;
  assert.equal(s["@type"], "BreadcrumbList");
  assert.equal(s.itemListElement.length, 2);
  assert.equal(s.itemListElement[0].position, 1);
  assert.equal(s.itemListElement[1].position, 2);
  assert.equal(s.itemListElement[0].item, `${SITE.url}/`);
  assert.equal(s.itemListElement[1].item, `${SITE.url}/shop`);
});

test("websiteSchema links back to the salon as publisher", () => {
  const s = websiteSchema() as any;
  assert.equal(s["@type"], "WebSite");
  assert.equal(s["@id"], `${SITE.url}/#website`);
  assert.equal(s.url, SITE.url);
  assert.equal(s.publisher["@id"], `${SITE.url}/#salon`);
});

test("faqSchema maps Q&A into Question/Answer nodes", () => {
  const s = faqSchema([{ q: "Do you take walk-ins?", a: "Yes, subject to availability." }]) as any;
  assert.equal(s["@type"], "FAQPage");
  assert.equal(s.mainEntity[0]["@type"], "Question");
  assert.equal(s.mainEntity[0].name, "Do you take walk-ins?");
  assert.equal(s.mainEntity[0].acceptedAnswer["@type"], "Answer");
  assert.equal(s.mainEntity[0].acceptedAnswer.text, "Yes, subject to availability.");
});
