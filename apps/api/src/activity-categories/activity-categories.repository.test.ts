import assert from "node:assert/strict";
import test from "node:test";

import {
  ActivityCategoryNameConflictError,
  ActivityCategoryVersionConflictError,
} from "./activity-categories.contracts.js";
import {
  ActivityCategoryRepository,
  type ActivityCategoriesDatabase,
} from "./activity-categories.repository.js";

test("lists only active Activity categories unless administrative listing is requested", async () => {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const database: ActivityCategoriesDatabase = {
    async query(sql, values) {
      queries.push({ sql, values });
      return { rowCount: 0, rows: [] };
    },
  };
  const repository = new ActivityCategoryRepository(database);

  await repository.listCategories(false);
  await repository.listCategories(true);

  assert.deepEqual(
    queries.map(({ values }) => values),
    [[false], [true]],
  );
  assert.match(
    queries[0]?.sql ?? "",
    /where \(\$1::boolean or "activity_category"\."is_active"\)/i,
  );
  assert.match(queries[0]?.sql ?? "", /order by lower\("activity_category"\."name"\)/i);
});

test("maps case-insensitive Activity category conflicts to a controlled error", async () => {
  const duplicate = Object.assign(new Error("duplicate"), { code: "23505" });
  const database: ActivityCategoriesDatabase = {
    async query() {
      throw duplicate;
    },
  };
  const repository = new ActivityCategoryRepository(database);

  await assert.rejects(
    () => repository.createCategory({ actorUserId: "user-1", name: "Desarrollo" }),
    ActivityCategoryNameConflictError,
  );
});

test("does not overwrite an Activity category with a stale version", async () => {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const database: ActivityCategoriesDatabase = {
    async query(sql, values) {
      queries.push({ sql, values });

      if (sql.includes('where "activity_category"."id" = $1')) {
        return { rowCount: 1, rows: [{ id: "category-1" }] };
      }

      return { rowCount: 0, rows: [] };
    },
  };
  const repository = new ActivityCategoryRepository(database);

  await assert.rejects(
    () =>
      repository.updateCategory("category-1", {
        actorUserId: "user-1",
        name: "Pruebas",
        version: 1,
      }),
    ActivityCategoryVersionConflictError,
  );
  assert.match(queries[0]?.sql ?? "", /where "id" = \$1 and "version" = \$6/i);
  assert.equal(queries[0]?.values?.at(-1), 1);
});
