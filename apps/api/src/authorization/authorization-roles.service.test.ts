import assert from "node:assert/strict";
import test from "node:test";

import type { AuthorizationRolesStore } from "./authorization-roles.service.js";
import { AuthorizationRolesService } from "./authorization-roles.service.js";

test("creates and lists custom roles with only fixed catalog permissions", async () => {
  const store: AuthorizationRolesStore = {
    async createCustomRole(input) {
      return {
        description: input.description,
        isActive: true,
        isDefault: false,
        key: input.key,
        kind: "custom",
        name: input.name,
        permissions: input.permissionKeys,
      };
    },
    async deleteCustomRole() {},
    async listRoleCatalog() {
      return {
        permissions: [
          {
            description: "Allows access.",
            key: "app.access",
            name: "Access",
          },
        ],
        roles: [],
      };
    },
    async updateRole(roleKey, input) {
      return {
        description: input.description,
        isActive: input.isActive ?? true,
        isDefault: false,
        key: roleKey,
        kind: "custom",
        name: input.name,
        permissions: input.permissionKeys,
      };
    },
  };
  const service = new AuthorizationRolesService(store);

  const catalog = await service.listRoleCatalog();
  const role = await service.createCustomRole({
    description: "Read-only custom role.",
    key: "read-only",
    name: "Read only",
    permissionKeys: ["app.access"],
  });

  assert.deepEqual(
    catalog.permissions.map((permission) => permission.key),
    ["app.access"],
  );
  assert.deepEqual(role, {
    description: "Read-only custom role.",
    isActive: true,
    isDefault: false,
    key: "read-only",
    kind: "custom",
    name: "Read only",
    permissions: ["app.access"],
  });
});
