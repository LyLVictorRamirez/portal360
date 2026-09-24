import assert from "node:assert/strict";
import test from "node:test";

import {
  type ActivityCategory,
  ActivityCategoryValidationError,
  type CreateActivityCategoryRecordInput,
  type UpdateActivityCategoryRecordInput,
} from "./activity-categories.contracts.js";
import {
  ActivityCategoryService,
  type ActivityCategoryStore,
} from "./activity-categories.service.js";

const categoryId = "4f9b1c2d-3513-4cc1-a266-c53589bbab77";
const timestamp = new Date("2026-09-22T00:00:00.000Z");

function createCategory(overrides: Partial<ActivityCategory> = {}): ActivityCategory {
  return {
    createdAt: timestamp,
    createdByUserId: "user-1",
    id: categoryId,
    isActive: true,
    name: "Desarrollo",
    updatedAt: timestamp,
    updatedByUserId: "user-1",
    version: 1,
    ...overrides,
  };
}

function createStore(overrides: Partial<ActivityCategoryStore> = {}): ActivityCategoryStore {
  return {
    async createCategory(): Promise<ActivityCategory> {
      return createCategory();
    },
    async listCategories(): Promise<ActivityCategory[]> {
      return [createCategory()];
    },
    async updateCategory(): Promise<ActivityCategory> {
      return createCategory();
    },
    ...overrides,
  };
}

test("creates a normalized Activity category with its authenticated actor", async () => {
  let receivedInput: CreateActivityCategoryRecordInput | undefined;
  const service = new ActivityCategoryService(
    createStore({
      async createCategory(input) {
        receivedInput = input;
        return createCategory({ name: input.name });
      },
    }),
  );

  await service.createCategory({ name: "  Desarrollo  " }, "user-1");

  assert.deepEqual(receivedInput, { actorUserId: "user-1", name: "Desarrollo" });
});

test("updates an Activity category with optimistic concurrency", async () => {
  let receivedId: string | undefined;
  let receivedInput: UpdateActivityCategoryRecordInput | undefined;
  const service = new ActivityCategoryService(
    createStore({
      async updateCategory(id, input) {
        receivedId = id;
        receivedInput = input;
        return createCategory({ isActive: input.isActive ?? true, version: 2 });
      },
    }),
  );

  await service.updateCategory(categoryId, { isActive: false, version: 1 }, "user-2");

  assert.equal(receivedId, categoryId);
  assert.deepEqual(receivedInput, { actorUserId: "user-2", isActive: false, version: 1 });
});

test("rejects invalid Activity category names before persistence", async () => {
  let attempts = 0;
  const service = new ActivityCategoryService(
    createStore({
      async createCategory() {
        attempts += 1;
        return createCategory();
      },
    }),
  );

  await assert.rejects(
    () => service.createCategory({ name: "   " }, "user-1"),
    ActivityCategoryValidationError,
  );
  await assert.rejects(
    () => service.updateCategory(categoryId, { version: 1 }, "user-1"),
    ActivityCategoryValidationError,
  );
  assert.equal(attempts, 0);
});
