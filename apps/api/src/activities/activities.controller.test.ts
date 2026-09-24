import assert from "node:assert/strict";
import test from "node:test";

import { ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";

import {
  type Activity,
<<<<<<< HEAD
=======
  type ActivityDependencies,
  ActivityDependencyValidationError,
>>>>>>> spec-14-dependencias-de-actividades
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
<<<<<<< HEAD
    async deleteActivity() {},
=======
    async createActivityDependency() {
      return { predecessors: [], successors: [] };
    },
    async deleteActivity() {},
    async deleteActivityDependency() {
      return { predecessors: [], successors: [] };
    },
>>>>>>> spec-14-dependencias-de-actividades
    async getActivity() {
      return activity();
    },
    async listActivities() {
      return { activities: [], page: 1, pageSize: 25, total: 0 };
    },
    async listAuditEvents() {
      return [];
    },
<<<<<<< HEAD
=======
    async listActivityDependencies() {
      return { predecessors: [], successors: [] };
    },
>>>>>>> spec-14-dependencias-de-actividades
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
<<<<<<< HEAD
=======
    [ActivitiesController.prototype.listActivityDependencies, ["activities.read"]],
    [ActivitiesController.prototype.createActivityDependency, ["activities.manage"]],
>>>>>>> spec-14-dependencias-de-actividades
    [ActivitiesController.prototype.getActivity, ["activities.read"]],
    [ActivitiesController.prototype.listAuditEvents, ["activities.read"]],
    [ActivitiesController.prototype.createActivity, ["activities.manage"]],
    [ActivitiesController.prototype.updateActivity, ["activities.manage"]],
    [ActivitiesController.prototype.moveActivity, ["activities.manage"]],
<<<<<<< HEAD
=======
    [ActivitiesController.prototype.deleteActivityDependency, ["activities.manage"]],
>>>>>>> spec-14-dependencias-de-actividades
    [ActivitiesController.prototype.deleteActivity, ["activities.manage"]],
  ])
    assert.deepEqual(Reflect.getMetadata(requiredPermissionsMetadataKey, handler), permissions);
});

<<<<<<< HEAD
=======
test("reads and mutates Activity dependencies with their successor version", async () => {
  let created: { activityId: string; input: unknown; actorUserId: string } | undefined;
  let removed: { activityId: string; predecessorActivityId: string; version: number } | undefined;
  const dependencies: ActivityDependencies = {
    predecessors: [{ id: "predecessor-1", name: "Preparar", status: "pending", version: 2 }],
    successors: [],
  };
  const controller = new ActivitiesController(
    store({
      async createActivityDependency(id, input, actorUserId) {
        created = { activityId: id, input, actorUserId };
        return dependencies;
      },
      async deleteActivityDependency(id, predecessorActivityId, input) {
        removed = { activityId: id, predecessorActivityId, version: input.version };
        return { predecessors: [], successors: [] };
      },
      async listActivityDependencies() {
        return dependencies;
      },
    }),
  );

  assert.deepEqual(await controller.listActivityDependencies(activityId), dependencies);
  assert.deepEqual(
    await controller.createActivityDependency(
      activityId,
      { predecessorActivityId: "predecessor-1", version: 3 },
      context,
    ),
    dependencies,
  );
  assert.deepEqual(created, {
    activityId,
    actorUserId: "user-1",
    input: { predecessorActivityId: "predecessor-1", version: 3 },
  });
  await controller.deleteActivityDependency(activityId, "predecessor-1", "3", context);
  assert.deepEqual(removed, { activityId, predecessorActivityId: "predecessor-1", version: 3 });
});

test("maps Activity dependency validation to HTTP 422", async () => {
  const controller = new ActivitiesController(
    store({
      async createActivityDependency() {
        throw new ActivityDependencyValidationError("Circular dependency.");
      },
    }),
  );
  await assert.rejects(
    () =>
      controller.createActivityDependency(
        activityId,
        { predecessorActivityId: "predecessor-1", version: 1 },
        context,
      ),
    (error: unknown) => error instanceof UnprocessableEntityException && error.getStatus() === 422,
  );
});

>>>>>>> spec-14-dependencias-de-actividades
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
