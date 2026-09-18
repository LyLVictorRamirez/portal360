import assert from "node:assert/strict";
import test from "node:test";

import { recordAuthorizationAuditEvent } from "./authorization-audit.js";

test("serializes authorization audit states in a database event", async () => {
  let receivedQuery = "";
  let receivedValues: unknown[] | undefined;

  await recordAuthorizationAuditEvent(
    {
      async query(query, values) {
        receivedQuery = query;
        receivedValues = values;
      },
    },
    {
      actorUserId: "administrator-1",
      afterState: null,
      beforeState: { roleKey: "custom-role", userId: "user-1" },
      eventType: "authorization.user_role.removed",
      subjectKey: "user-1:custom-role",
      subjectType: "user_role",
    },
  );

  assert.match(receivedQuery, /insert into "authorization"\."audit_event"/);
  assert.deepEqual(receivedValues, [
    "authorization.user_role.removed",
    "administrator-1",
    "user_role",
    "user-1:custom-role",
    JSON.stringify({ roleKey: "custom-role", userId: "user-1" }),
    null,
  ]);
});
