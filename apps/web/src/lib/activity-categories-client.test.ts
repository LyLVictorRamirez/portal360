import assert from "node:assert/strict";
import test from "node:test";

import { listActivityCategories, updateActivityCategory } from "./activity-categories-client.ts";

const category = { id: "category-1", name: "Desarrollo", isActive: true, version: 1 };
test("lists administrative Activity categories and updates them through same-origin endpoints", async () => {
  const calls: string[] = [];
  const fetchImplementation: typeof fetch = async (input, init) => {
    calls.push(input.toString());
    return init?.method ? Response.json({ category }) : Response.json({ categories: [category] });
  };
  assert.deepEqual(await listActivityCategories(true, fetchImplementation), {
    kind: "success",
    data: [category],
  });
  assert.deepEqual(
    await updateActivityCategory(
      "category/1",
      { isActive: false, version: 1 },
      fetchImplementation,
    ),
    { kind: "success", data: category },
  );
  assert.deepEqual(calls, [
    "/api/activity-categories?includeInactive=true",
    "/api/activity-categories/category%2F1",
  ]);
});
