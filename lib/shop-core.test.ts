import { test } from "node:test";
import assert from "node:assert/strict";
import { isSellable, clampQty, orderTotal, slugify, type ShopProduct } from "./shop-core.ts";

const p = (o: Partial<ShopProduct> & Pick<ShopProduct, "id">): ShopProduct => ({
  name: "Item", saleAED: 100, qty: 5, retail: true, active: true, imageUrl: "https://x/i.jpg", ...o,
});

test("isSellable requires published + active + price + image + stock", () => {
  assert.equal(isSellable(p({ id: "a" })), true);
  assert.equal(isSellable(p({ id: "b", retail: false })), false, "unpublished");
  assert.equal(isSellable(p({ id: "c", active: false })), false, "inactive");
  assert.equal(isSellable(p({ id: "d", saleAED: null })), false, "no price");
  assert.equal(isSellable(p({ id: "e", saleAED: 0 })), false, "zero price");
  assert.equal(isSellable(p({ id: "f", imageUrl: null })), false, "no image");
  assert.equal(isSellable(p({ id: "g", qty: 0 })), false, "out of stock");
});

test("clampQty clamps to stock and floors, never negative", () => {
  assert.equal(clampQty(3, 5), 3);
  assert.equal(clampQty(9, 5), 5); // clamp to stock
  assert.equal(clampQty(-2, 5), 0);
  assert.equal(clampQty(2.7, 5), 2); // floor
  assert.equal(clampQty(NaN, 5), 0);
  assert.equal(clampQty(3, 0), 0); // no stock
});

test("orderTotal sums sellable lines, clamps to stock, skips unsellable", () => {
  const catalog: Record<string, ShopProduct> = {
    a: p({ id: "a", saleAED: 100, qty: 5 }),
    b: p({ id: "b", saleAED: 250, qty: 2 }),
    draft: p({ id: "draft", retail: false }),
    oos: p({ id: "oos", qty: 0 }),
  };
  const r = orderTotal(
    [{ productId: "a", qty: 3 }, { productId: "b", qty: 10 }, { productId: "draft", qty: 1 }, { productId: "oos", qty: 1 }, { productId: "ghost", qty: 1 }],
    (id) => catalog[id],
  );
  assert.equal(r.items.length, 2); // a + b only
  assert.equal(r.items[1].qty, 2); // b clamped 10 → stock 2
  assert.equal(r.itemCount, 5); // 3 + 2
  assert.equal(r.totalAED, 3 * 100 + 2 * 250); // 800
});

test("slugify makes clean URL slugs", () => {
  assert.equal(slugify("Brazilian Body Wave Bundle"), "brazilian-body-wave-bundle");
  assert.equal(slugify("Silky Straight — Indian Hair!"), "silky-straight-indian-hair");
  assert.equal(slugify("  Spaces  &  Symbols?? "), "spaces-symbols");
  assert.equal(slugify(""), "product");
  assert.equal(slugify("!!!"), "product");
});

test("empty / all-unsellable cart totals to zero", () => {
  const r = orderTotal([{ productId: "x", qty: 1 }], () => undefined);
  assert.equal(r.itemCount, 0);
  assert.equal(r.totalAED, 0);
  assert.deepEqual(r.items, []);
});
