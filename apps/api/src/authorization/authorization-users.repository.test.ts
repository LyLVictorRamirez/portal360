import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthorizationRoleAssignmentError,
  AuthorizationUsersRepository,
} from "./authorization-users.repository.js";

test("does not remove the last active role from a person", async () => {
  let connected = false;
  const repository = new AuthorizationUsersRepository({
    connect: async () => {
      connected = true;
      throw new Error("The repository must reject this before opening a transaction.");
    },
    query: async () => ({ rowCount: 0, rows: [] }),
  });

  await assert.rejects(
    () => repository.replaceUserRoles("user-1", [], "administrator-1"),
    AuthorizationRoleAssignmentError,
  );
  assert.equal(connected, false);
});
