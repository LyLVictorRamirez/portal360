import assert from "node:assert/strict";
import test from "node:test";

import type { AuthorizationUsersStore } from "./authorization-users.service.js";
import { AuthorizationUsersService } from "./authorization-users.service.js";

test("lists unverified users and delegates their role preassignment", async () => {
  const calls: Array<{
    actorUserId?: string | null;
    roleKeys?: string[];
    search?: string;
    userId?: string;
  }> = [];
  const store: AuthorizationUsersStore = {
    async listUsers(search) {
      calls.push({ search });

      return [
        {
          email: "pending@example.test",
          emailVerified: false,
          id: "user-1",
          name: "Pending user",
          roles: [],
        },
      ];
    },
    async replaceUserRoles(userId, roleKeys, actorUserId) {
      calls.push({ actorUserId, roleKeys, userId });

      return [
        {
          description: "Minimum access.",
          isActive: true,
          isDefault: true,
          key: "estandar",
          kind: "system",
          name: "Estándar",
        },
      ];
    },
  };
  const service = new AuthorizationUsersService(store);

  const users = await service.listUsers(" pending ");
  const roles = await service.replaceUserRoles("user-1", ["estandar"], "admin-1");

  assert.equal(users[0]?.emailVerified, false);
  assert.deepEqual(
    roles.map((role) => role.key),
    ["estandar"],
  );
  assert.deepEqual(calls, [
    { search: "pending" },
    { actorUserId: "admin-1", roleKeys: ["estandar"], userId: "user-1" },
  ]);
});
