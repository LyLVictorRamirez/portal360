import assert from "node:assert/strict";
import test from "node:test";

import { filterActivityCategories, paginateActivityCategories } from "./activity-category-list.ts";

const categories = [
  { id: "1", name: "Consultoría", isActive: true, version: 1 },
  { id: "2", name: "Desarrollo", isActive: false, version: 1 },
  { id: "3", name: "Documentación", isActive: true, version: 1 },
];

test("filters Activity categories by name and availability", () => {
  assert.deepEqual(filterActivityCategories(categories, { availability: "active", query: "doc" }), [
    categories[2],
  ]);
  assert.deepEqual(filterActivityCategories(categories, { availability: "inactive", query: "" }), [
    categories[1],
  ]);
});

test("paginates filtered Activity categories", () => {
  assert.deepEqual(paginateActivityCategories(categories, 2, 2), [categories[2]]);
  assert.deepEqual(paginateActivityCategories(categories, 0, 2), [categories[0], categories[1]]);
});
