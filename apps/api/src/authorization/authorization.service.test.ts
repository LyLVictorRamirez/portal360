import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthorizationRepository,
  type AuthorizationQueryExecutor,
} from "./authorization.repository.js";
import { AuthorizationService } from "./authorization.service.js";

test("unites permissions from every active role assigned to a user", async () => {
  const database: AuthorizationQueryExecutor = {
    async query(_query, values) {
      assert.deepEqual(values, ["user-1"]);

      return {
        rows: [
          {
            permission_key: "authorization.roles.manage",
            role_description: "Can manage roles.",
            role_is_active: true,
            role_is_default: false,
            role_key: "custom-role-manager",
            role_kind: "custom",
            role_name: "Role manager",
          },
          {
            permission_key: "app.access",
            role_description: "Minimum access.",
            role_is_active: true,
            role_is_default: true,
            role_key: "estandar",
            role_kind: "system",
            role_name: "Estándar",
          },
          {
            permission_key: "authorization.users.read",
            role_description: "Can manage roles.",
            role_is_active: true,
            role_is_default: false,
            role_key: "custom-role-manager",
            role_kind: "custom",
            role_name: "Role manager",
          },
        ],
      };
    },
  };
  const service = new AuthorizationService(new AuthorizationRepository(database));

  const authorization = await service.resolveUserAuthorization("user-1");

  assert.deepEqual(authorization.permissions, [
    "authorization.roles.manage",
    "app.access",
    "authorization.users.read",
  ]);
  assert.deepEqual(
    authorization.roles.map((role) => role.key),
    ["custom-role-manager", "estandar"],
  );
  assert.equal(await service.userHasPermission("user-1", "authorization.roles.manage"), true);
});

test("resolves Requirement permissions from the current database state on every request", async () => {
  let queryCount = 0;
  const database: AuthorizationQueryExecutor = {
    async query() {
      queryCount += 1;

      return {
        rows:
          queryCount === 1
            ? [
                {
                  permission_key: "app.access",
                  role_description: "Minimum access.",
                  role_is_active: true,
                  role_is_default: true,
                  role_key: "estandar",
                  role_kind: "system",
                  role_name: "Estándar",
                },
              ]
            : [
                {
                  permission_key: "requirements.manage",
                  role_description: "Can manage requirements.",
                  role_is_active: true,
                  role_is_default: false,
                  role_key: "lider",
                  role_kind: "system",
                  role_name: "Líder",
                },
              ],
      };
    },
  };
  const service = new AuthorizationService(new AuthorizationRepository(database));

  const beforeAssignmentChange = await service.resolveUserAuthorization("user-1");
  const afterAssignmentChange = await service.resolveUserAuthorization("user-1");

  assert.deepEqual(beforeAssignmentChange.permissions, ["app.access"]);
  assert.deepEqual(afterAssignmentChange.permissions, ["requirements.manage"]);
  assert.equal(queryCount, 2);
});

test("resolves Ticket permissions from the current database state on every request", async () => {
  let queryCount = 0;
  const database: AuthorizationQueryExecutor = {
    async query() {
      queryCount += 1;

      return {
        rows:
          queryCount === 1
            ? [
                {
                  permission_key: "app.access",
                  role_description: "Minimum access.",
                  role_is_active: true,
                  role_is_default: true,
                  role_key: "estandar",
                  role_kind: "system",
                  role_name: "Estándar",
                },
              ]
            : [
                {
                  permission_key: "tickets.manage",
                  role_description: "Can manage tickets.",
                  role_is_active: true,
                  role_is_default: false,
                  role_key: "lider",
                  role_kind: "system",
                  role_name: "Líder",
                },
              ],
      };
    },
  };
  const service = new AuthorizationService(new AuthorizationRepository(database));

  const beforeAssignmentChange = await service.resolveUserAuthorization("user-1");
  const afterAssignmentChange = await service.resolveUserAuthorization("user-1");

  assert.deepEqual(beforeAssignmentChange.permissions, ["app.access"]);
  assert.deepEqual(afterAssignmentChange.permissions, ["tickets.manage"]);
  assert.equal(queryCount, 2);
});
