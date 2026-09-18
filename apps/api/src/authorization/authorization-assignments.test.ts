import assert from "node:assert/strict";
import test from "node:test";

import {
  assignDefaultRole,
  type AuthorizationMutationExecutor,
} from "./authorization-assignments.js";

test("assigns the standard role idempotently", async () => {
  let assignmentAttempts = 0;
  const database: AuthorizationMutationExecutor = {
    async query(query, values) {
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
});
