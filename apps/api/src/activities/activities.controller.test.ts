import assert from "node:assert/strict";
import test from "node:test";

import { ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";

import {
  type Activity,
  ActivityNotFoundError,
  ActivityValidationError,
  ActivityVersionConflictError,
} from "./activities.contracts.js";
import { ActivitiesController, type ActivitiesControllerStore } from "./activities.controller.js";
import { requiredPermissionsMetadataKey } from "../authorization/require-permissions.decorator.js";
import type { AuthorizationRequestContext } from "../authorization/authorization.types.js";

const timestamp = new Date("2026-09-22T00:00:00.000Z");
const activityId = "4f9b1c2d-3513-4cc1-a266-c53589bbab77";
const context: AuthorizationRequestContext = {
  authorization: { permissions: ["activities.manage", "activities.read"], roles: [] },
  userId: "user-1",
};
function activity(): Activity {
  return {
    activityCategoryId: "category-1",
    assignedUserId: "user-1",
    assignedUserName: "Usuario uno",
    blockedReason: null,
    blockedStartedAt: null,
    clientName: "Cliente uno",
    containerId: "project-1",
    containerName: "PRO-001 · Proyecto",
    containerType: "project",
    createdAt: timestamp,
    createdByUserId: "user-1",
    customerCommitmentDate: null,
    description: null,
    estimatedHours: 1,
    id: activityId,
    isCustomerDeliverable: false,
    name: "Actividad",
    parentActivityId: null,
    position: 1,
    priority: "medium",
    projectStageId: "stage-1",
    projectStageName: "Planeación",
    status: "pending",
    targetDate: null,
    updatedAt: timestamp,
    updatedByUserId: "user-1",
    version: 1,
    waitingFor: null,
    waitingReason: null,
    waitingStartedAt: null,
  };
}
function store(overrides: Partial<ActivitiesControllerStore> = {}): ActivitiesControllerStore {
  return {
    async createActivity() {
      return activity();
    },
    async deleteActivity() {},
    async getActivity() {
      return activity();
    },
    async listActivities() {
      return { activities: [], page: 1, pageSize: 25, total: 0 };
    },
    async listAuditEvents() {
      return [];
    },
    async listAssignees() {
      return [];
    },
    async moveActivity() {
      return activity();
    },
    async updateActivity() {
      return activity();
    },
    ...overrides,
  };
}

test("declares Activity permission boundaries for every operational route", () => {
  for (const [handler, permissions] of [
    [ActivitiesController.prototype.listActivities, ["activities.read"]],
    [ActivitiesController.prototype.listAssignees, ["activities.manage"]],
    [ActivitiesController.prototype.getActivity, ["activities.read"]],
    [ActivitiesController.prototype.listAuditEvents, ["activities.read"]],
    [ActivitiesController.prototype.createActivity, ["activities.manage"]],
    [ActivitiesController.prototype.updateActivity, ["activities.manage"]],
    [ActivitiesController.prototype.moveActivity, ["activities.manage"]],
    [ActivitiesController.prototype.deleteActivity, ["activities.manage"]],
  ])
    assert.deepEqual(Reflect.getMetadata(requiredPermissionsMetadataKey, handler), permissions);
});

test("maps Activity not found, conflict, and validation errors to controlled responses", async () => {
  const controller = new ActivitiesController(
    store({
      async getActivity() {
        throw new ActivityNotFoundError("Missing Activity.");
      },
      async updateActivity() {
        throw new ActivityVersionConflictError("Reload Activity.");
      },
      async createActivity() {
        throw new ActivityValidationError("Invalid Activity.");
      },
    }),
  );
  await assert.rejects(
    () => controller.getActivity(activityId),
    (error: unknown) => error instanceof NotFoundException && error.getStatus() === 404,
  );
  await assert.rejects(
    () => controller.updateActivity(activityId, { version: 1 }, context),
    (error: unknown) => error instanceof ConflictException && error.getStatus() === 409,
  );
  await assert.rejects(
    () =>
      controller.createActivity(
        {
          activityCategoryId: "category-1",
          assignedUserId: "user-1",
          containerId: "project-1",
          containerType: "project",
          estimatedHours: 1,
          name: "Actividad",
          projectStageId: "stage-1",
        },
        context,
      ),
    (error: unknown) => error instanceof UnprocessableEntityException && error.getStatus() === 422,
  );
});
