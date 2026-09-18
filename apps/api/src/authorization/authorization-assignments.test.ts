import assert from "node:assert/strict";
import test from "node:test";

import {
  assignDefaultRole,
  type AuthorizationMutationExecutor,
} from "./authorization-assignments.js";

test("assigns the standard role idempotently", async () => {
  let assignmentAttempts = 0;
  let auditEvents = 0;
  const database: AuthorizationMutationExecutor = {
    async query(query, values) {
      if (query.includes('"audit_event"')) {
        auditEvents += 1;
        assert.equal(values?.[0], "authorization.user_role.assigned");

        return { rowCount: 1, rows: [] };
      }

      assert.deepEqual(values, ["user-1"]);

      if (!query.includes("insert into")) {
        return { rowCount: 1, rows: [] };
      }

      assignmentAttempts += 1;

      return {
        rowCount: assignmentAttempts === 1 ? 1 : 0,
        rows: [],
      };
    },
  };

  assert.equal(await assignDefaultRole(database, "user-1"), true);
  assert.equal(await assignDefaultRole(database, "user-1"), false);
  assert.equal(auditEvents, 1);
});
