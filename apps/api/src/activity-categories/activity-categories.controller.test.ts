import assert from "node:assert/strict";
import test from "node:test";

import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";

import {
  type ActivityCategory,
  ActivityCategoryNameConflictError,
  ActivityCategoryVersionConflictError,
} from "./activity-categories.contracts.js";
import {
  ActivityCategoriesController,
  type ActivityCategoriesControllerStore,
} from "./activity-categories.controller.js";
import type { AuthorizationRequestContext } from "../authorization/authorization.types.js";
import { requiredPermissionsMetadataKey } from "../authorization/require-permissions.decorator.js";

const timestamp = new Date("2026-09-22T00:00:00.000Z");
const categoryId = "4f9b1c2d-3513-4cc1-a266-c53589bbab77";
const readContext: AuthorizationRequestContext = {
  authorization: { permissions: ["activities.read"], roles: [] },
  userId: "user-1",
};
const managerContext: AuthorizationRequestContext = {
  authorization: { permissions: ["activities.read", "activity-categories.manage"], roles: [] },
  userId: "user-1",
};

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

function createStore(
  overrides: Partial<ActivityCategoriesControllerStore> = {},
): ActivityCategoriesControllerStore {
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

test("declares Activity category permission boundaries", () => {
  assert.deepEqual(
    Reflect.getMetadata(
      requiredPermissionsMetadataKey,
      ActivityCategoriesController.prototype.listCategories,
    ),
    ["activities.read"],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      requiredPermissionsMetadataKey,
      ActivityCategoriesController.prototype.createCategory,
    ),
    ["activity-categories.manage"],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      requiredPermissionsMetadataKey,
      ActivityCategoriesController.prototype.updateCategory,
    ),
    ["activity-categories.manage"],
  );
});

test("exposes active categories to Activity readers and inactive categories only to administrators", async () => {
  let receivedIncludeInactive: boolean | undefined;
  const controller = new ActivityCategoriesController(
    createStore({
      async listCategories(includeInactive) {
        receivedIncludeInactive = includeInactive;
        return [createCategory()];
      },
    }),
  );

  const response = await controller.listCategories(undefined, readContext);
  assert.equal(receivedIncludeInactive, false);
  assert.deepEqual(response.categories, [
    { id: categoryId, isActive: true, name: "Desarrollo", version: 1 },
  ]);

  await assert.rejects(
    () => controller.listCategories("true", readContext),
    (error: unknown) => error instanceof ForbiddenException && error.getStatus() === 403,
  );

  await controller.listCategories("true", managerContext);
  assert.equal(receivedIncludeInactive, true);
});

test("maps category conflicts and stale updates to their HTTP responses", async () => {
  const controller = new ActivityCategoriesController(
    createStore({
      async createCategory() {
        throw new ActivityCategoryNameConflictError("Duplicate category.");
      },
      async updateCategory() {
        throw new ActivityCategoryVersionConflictError("Reload category.");
      },
    }),
  );

  await assert.rejects(
    () => controller.createCategory({ name: "Desarrollo" }, managerContext),
    (error: unknown) => error instanceof UnprocessableEntityException && error.getStatus() === 422,
  );
  await assert.rejects(
    () => controller.updateCategory(categoryId, { name: "Pruebas", version: 1 }, managerContext),
    (error: unknown) => error instanceof ConflictException && error.getStatus() === 409,
  );
});
