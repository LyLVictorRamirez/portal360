import assert from "node:assert/strict";
import test from "node:test";

import {
  type Activity,
<<<<<<< HEAD
  ActivityValidationError,
  type CreateActivityRecordInput,
=======
  ActivityDependencyValidationError,
  ActivityValidationError,
  ActivityVersionConflictError,
  type CreateActivityRecordInput,
  type CreateActivityDependencyRecordInput,
>>>>>>> spec-14-dependencias-de-actividades
  type ListActivitiesQuery,
  type UpdateActivityRecordInput,
} from "./activities.contracts.js";
import { ActivityService, type ActivityStore } from "./activities.service.js";

const activityId = "4f9b1c2d-3513-4cc1-a266-c53589bbab77";
const projectId = "5d676d8c-9939-4a25-bdda-1a4df8b17873";
const timestamp = new Date("2026-09-22T00:00:00.000Z");
function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    activityCategoryId: "category-1",
    assignedUserId: "user-1",
    assignedUserName: "Usuario uno",
    blockedReason: null,
    blockedStartedAt: null,
    clientName: "Cliente uno",
    containerId: projectId,
    containerName: "PRO-001 · Proyecto",
    containerType: "project",
    createdAt: timestamp,
    createdByUserId: "user-1",
    customerCommitmentDate: null,
    description: null,
    estimatedHours: 2,
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
    ...overrides,
  };
}
function store(overrides: Partial<ActivityStore> = {}): ActivityStore {
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
    async listActivities(query: ListActivitiesQuery) {
      return { activities: [], page: query.page, pageSize: query.pageSize, total: 0 };
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

test("creates Activities with pending and medium defaults", async () => {
  let received: CreateActivityRecordInput | undefined;
  const service = new ActivityService(
    store({
      async createActivity(input) {
        received = input;
        return activity({ status: input.status, priority: input.priority });
      },
    }),
  );
  await service.createActivity(
    {
      activityCategoryId: "category-1",
      assignedUserId: "user-2",
      containerId: projectId,
      containerType: "project",
      estimatedHours: 2.5,
      name: "  Preparar entrega  ",
      projectStageId: "stage-1",
    },
    "user-1",
  );
  assert.deepEqual(received, {
    activityCategoryId: "category-1",
    assignedUserId: "user-2",
    blockedReason: undefined,
    containerId: projectId,
    containerType: "project",
    customerCommitmentDate: null,
    description: undefined,
    estimatedHours: 2.5,
    isCustomerDeliverable: false,
    name: "Preparar entrega",
    parentActivityId: null,
    priority: "medium",
    projectStageId: "stage-1",
    status: "pending",
    targetDate: undefined,
    waitingFor: undefined,
    waitingReason: undefined,
    actorUserId: "user-1",
  });
});

<<<<<<< HEAD
=======
test("creates and removes dependencies with the successor version and authenticated actor", async () => {
  let created: CreateActivityDependencyRecordInput | undefined;
  let removed:
    | {
        activityId: string;
        predecessorActivityId: string;
        input: { actorUserId: string; version: number };
      }
    | undefined;
  const service = new ActivityService(
    store({
      async createActivityDependency(_id, input) {
        created = input;
        return { predecessors: [], successors: [] };
      },
      async deleteActivityDependency(id, predecessorActivityId, input) {
        removed = { activityId: id, predecessorActivityId, input };
        return { predecessors: [], successors: [] };
      },
    }),
  );

  await service.createActivityDependency(
    activityId,
    { predecessorActivityId: "predecessor-1", version: 4 },
    "user-2",
  );
  assert.deepEqual(created, {
    actorUserId: "user-2",
    predecessorActivityId: "predecessor-1",
    version: 4,
  });

  await service.deleteActivityDependency(activityId, "predecessor-1", { version: 5 }, "user-2");
  assert.deepEqual(removed, {
    activityId,
    predecessorActivityId: "predecessor-1",
    input: { actorUserId: "user-2", version: 5 },
  });
});

test("rejects malformed dependency mutations before they reach storage", async () => {
  let called = false;
  const service = new ActivityService(
    store({
      async createActivityDependency() {
        called = true;
        return { predecessors: [], successors: [] };
      },
    }),
  );
  await assert.rejects(
    () =>
      service.createActivityDependency(
        activityId,
        { predecessorActivityId: "predecessor-1", version: 0 },
        "user-1",
      ),
    ActivityValidationError,
  );
  assert.equal(called, false);
});

test("keeps dependency conflicts and validation errors controlled", async () => {
  const service = new ActivityService(
    store({
      async createActivityDependency() {
        throw new ActivityDependencyValidationError("Activity dependencies cannot form a cycle.");
      },
      async deleteActivityDependency() {
        throw new ActivityVersionConflictError("Reload Activity.");
      },
    }),
  );
  await assert.rejects(
    () =>
      service.createActivityDependency(
        activityId,
        { predecessorActivityId: "predecessor-1", version: 1 },
        "user-1",
      ),
    ActivityDependencyValidationError,
  );
  await assert.rejects(
    () => service.deleteActivityDependency(activityId, "predecessor-1", { version: 1 }, "user-1"),
    ActivityVersionConflictError,
  );
});

>>>>>>> spec-14-dependencias-de-actividades
test("sets and clears transient blocked state data", async () => {
  let received: UpdateActivityRecordInput | undefined;
  const service = new ActivityService(
    store({
      async updateActivity(_id, input) {
        received = input;
        return activity({ status: input.status ?? "pending" });
      },
    }),
  );
  await service.updateActivity(
    activityId,
    { blockedReason: "  Esperando respuesta  ", status: "blocked", version: 1 },
    "user-2",
  );
  assert.equal(received?.blockedReason, "Esperando respuesta");
  assert.ok(received?.blockedStartedAt instanceof Date);
  await service.updateActivity(activityId, { status: "in_progress", version: 1 }, "user-2");
  assert.equal(received?.blockedReason, null);
  assert.equal(received?.blockedStartedAt, null);
});

test("uses 25 rows and normalizes Activity filters", async () => {
  let received: ListActivitiesQuery | undefined;
  const service = new ActivityService(
    store({
      async listActivities(query) {
        received = query;
        return { activities: [], page: query.page, pageSize: query.pageSize, total: 0 };
      },
    }),
  );
  await service.listActivities({
    containerType: "ticket",
    page: 2,
    priority: "high",
    query: "  entrega  ",
    status: "in_review",
  });
  assert.deepEqual(received, {
    activityCategoryId: null,
    assignedUserId: null,
    clientId: null,
    containerId: null,
    containerType: "ticket",
    page: 2,
    pageSize: 25,
    priority: "high",
    query: "entrega",
    status: "in_review",
  });
});

test("rejects a waiting Activity without complete wait data", async () => {
  const service = new ActivityService(store());
  await assert.rejects(
    () =>
      service.createActivity(
        {
          activityCategoryId: "category-1",
          assignedUserId: "user-1",
          containerId: projectId,
          containerType: "project",
          estimatedHours: 1,
          name: "Actividad",
          projectStageId: "stage-1",
          status: "waiting_third_party",
        },
        "user-1",
      ),
    ActivityValidationError,
  );
});
