import assert from "node:assert/strict";
import test from "node:test";

import {
  type Activity,
  ActivityValidationError,
  type CreateActivityRecordInput,
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
    async deleteActivity() {},
    async getActivity() {
      return activity();
    },
    async listAuditEvents() {
      return [];
    },
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
