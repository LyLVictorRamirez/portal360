import assert from "node:assert/strict";
import test from "node:test";

<<<<<<< HEAD
import { containerActivityLockQuery } from "./activities.repository.js";
=======
import {
  ActivityRepository,
  containerActivityLockQuery,
  type ActivitiesDatabase,
} from "./activities.repository.js";
>>>>>>> spec-14-dependencias-de-actividades

test("locks Tickets without selecting a status that their schema does not contain", () => {
  assert.equal(
    containerActivityLockQuery("ticket", "ticket"),
    'select "id" from "business"."ticket" where "id" = $1 for update',
  );
});

test("keeps status available for terminal Project and Requirement validation", () => {
  assert.equal(
    containerActivityLockQuery("project", "project"),
    'select "status" from "business"."project" where "id" = $1 for update',
  );
  assert.equal(
    containerActivityLockQuery("requirement", "requirement"),
    'select "status" from "business"."requirement" where "id" = $1 for update',
  );
});
<<<<<<< HEAD
=======

test("creates a dependency transactionally, increments only its successor, and audits both ends", async () => {
  const queries: Array<{ query: string; values?: unknown[] }> = [];
  const predecessorId = "predecessor-1";
  const successorId = "successor-1";
  const transaction = {
    async query(query: string, values?: unknown[]) {
      queries.push({ query, values });
      if (query.includes('from "business"."activity" as "activity" where "activity"."id" = $1')) {
        return {
          rowCount: 1,
          rows: [activityRow(values?.[0] === predecessorId ? predecessorId : successorId)],
        };
      }
      if (query.includes('select 1 from "business"."activity_dependency"')) {
        return { rowCount: 0, rows: [] };
      }
      if (query.includes("with recursive descendants")) return { rowCount: 0, rows: [] };
      if (query.includes('inner join "business"."activity" as "activity"')) {
        return { rowCount: 0, rows: [] };
      }
      if (query.startsWith('update "business"."activity"')) {
        return { rowCount: 1, rows: [{ id: successorId }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  const database: ActivitiesDatabase = {
    connect: async () => transaction,
    query: transaction.query,
  };

  await new ActivityRepository(database).createActivityDependency(successorId, {
    actorUserId: "user-1",
    predecessorActivityId: predecessorId,
    version: 2,
  });

  assert.equal(
    queries.some(({ query }) => query === "BEGIN"),
    true,
  );
  assert.equal(
    queries.some(({ query }) => query.includes('insert into "business"."activity_dependency"')),
    true,
  );
  assert.equal(
    queries.filter(({ query }) => query.startsWith('update "business"."activity"')).length,
    1,
  );
  const auditQueries = queries.filter(({ query }) =>
    query.includes('insert into "business"."audit_event"'),
  );
  assert.equal(auditQueries.length, 2);
  assert.match(String(auditQueries[0]?.values?.[2]), /predecessors/);
  assert.match(String(auditQueries[1]?.values?.[2]), /successors/);
  assert.equal(queries.at(-1)?.query, "COMMIT");
});

function activityRow(id: string): Record<string, unknown> {
  return {
    activity_category_id: "category-1",
    assigned_user_id: "user-1",
    assigned_user_name: "Usuario uno",
    blocked_reason: null,
    blocked_started_at: null,
    client_name: "Cliente uno",
    container_name: "PRO-001 · Proyecto",
    created_at: new Date("2026-09-22T00:00:00.000Z"),
    created_by_user_id: "user-1",
    customer_commitment_date: null,
    description: null,
    estimated_hours: 1,
    id,
    is_customer_deliverable: false,
    name: id === "predecessor-1" ? "Preparar" : "Entregar",
    parent_activity_id: null,
    position: 1,
    priority: "medium",
    project_id: "project-1",
    project_stage_id: "stage-1",
    project_stage_name: "Planeación",
    requirement_id: null,
    status: "pending",
    target_date: null,
    ticket_id: null,
    updated_at: new Date("2026-09-22T00:00:00.000Z"),
    updated_by_user_id: "user-1",
    version: 2,
    waiting_for: null,
    waiting_reason: null,
    waiting_started_at: null,
  };
}
>>>>>>> spec-14-dependencias-de-actividades
