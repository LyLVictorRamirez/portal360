import assert from "node:assert/strict";
import test from "node:test";

import {
  createActivity,
  deleteActivity,
  listActivityAssignees,
  listActivities,
  moveActivity,
} from "./activities-client.ts";

const activity = {
  id: "activity-1",
  name: "Actividad",
  status: "pending",
  priority: "medium",
  version: 1,
  clientName: "Cliente uno",
  containerId: "project-1",
  containerName: "PRO-001 · Proyecto",
  containerType: "project",
  activityCategoryId: "category-1",
  assignedUserId: "user-1",
  assignedUserName: "Usuario uno",
  estimatedHours: 1,
  position: 1,
  projectStageId: "stage-1",
  projectStageName: "Planeación",
  parentActivityId: null,
  description: null,
  targetDate: null,
  isCustomerDeliverable: false,
  customerCommitmentDate: null,
  blockedReason: null,
  waitingReason: null,
  waitingFor: null,
};

test("uses same-origin Activity endpoints for filters and mutations", async () => {
  const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImplementation: typeof fetch = async (input, init) => {
    requests.push({ url: input.toString(), init });
    if (input.toString().startsWith("/api/activities/assignees")) {
      return Response.json({
        assignees: [{ email: "ana@example.com", id: "user-1", name: "Ana" }],
      });
    }
    return init?.method === "DELETE"
      ? new Response(null, { status: 204 })
      : Response.json(
          init?.method
            ? { activity }
            : { activities: [activity], page: 2, pageSize: 25, total: 26 },
        );
  };
  assert.deepEqual(
    await listActivities({ page: 2, query: "  entrega  ", status: "pending" }, fetchImplementation),
    { kind: "success", data: { activities: [activity], page: 2, pageSize: 25, total: 26 } },
  );
  assert.deepEqual(await createActivity({ name: "Actividad" }, fetchImplementation), {
    kind: "success",
    data: activity,
  });
  assert.deepEqual(await moveActivity("activity/1", "down", 1, fetchImplementation), {
    kind: "success",
    data: activity,
  });
  assert.deepEqual(await deleteActivity("activity/1", 1, fetchImplementation), {
    kind: "success",
    data: undefined,
  });
  assert.deepEqual(await listActivityAssignees("  ana  ", fetchImplementation), {
    kind: "success",
    data: [{ email: "ana@example.com", id: "user-1", name: "Ana" }],
  });
  assert.deepEqual(
    requests.map(({ url, init }) => ({ url, method: init?.method })),
    [
      { url: "/api/activities?page=2&query=entrega&status=pending", method: undefined },
      { url: "/api/activities", method: "POST" },
      { url: "/api/activities/activity%2F1/move", method: "POST" },
      { url: "/api/activities/activity%2F1?version=1", method: "DELETE" },
      { url: "/api/activities/assignees?query=ana", method: undefined },
    ],
  );
});

test("maps Activity conflicts and validation responses", async () => {
  assert.deepEqual(
    await moveActivity("activity-1", "up", 1, async () =>
      Response.json({ message: "Recarga." }, { status: 409 }),
    ),
    { kind: "conflict", message: "Recarga." },
  );
  assert.deepEqual(
    await createActivity({ name: "" }, async () =>
      Response.json({ message: "Nombre requerido." }, { status: 422 }),
    ),
    { kind: "validation", message: "Nombre requerido." },
  );
});
