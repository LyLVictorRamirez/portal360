import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthorizationRoleMutationError,
  AuthorizationRolesRepository,
} from "./authorization-roles.repository.js";

type RoleRow = Record<string, unknown> & {
  role_description: string;
  role_is_active: boolean;
  role_is_default: boolean;
  role_key: string;
  role_kind: "custom" | "system";
  role_name: string;
};

class RoleMutationClient {
  auditEventCount = 0;
  released = false;

  constructor(
    private readonly role: RoleRow,
    private readonly options: {
      hasAssignments?: boolean;
      hasRoleManager?: boolean;
      wouldLoseLastActiveRole?: boolean;
    } = {},
  ) {}

  async query(query: string): Promise<{ rowCount: number; rows: Record<string, unknown>[] }> {
    if (query.includes('"audit_event"')) {
      this.auditEventCount += 1;

      return { rowCount: 1, rows: [] };
    }

    if (query.includes("as has_assignments")) {
      return { rowCount: 1, rows: [{ has_assignments: this.options.hasAssignments ?? false }] };
    }

    if (query.includes("as would_lose_last_active_role")) {
      return {
        rowCount: 1,
        rows: [{ would_lose_last_active_role: this.options.wouldLoseLastActiveRole ?? false }],
      };
    }

    if (query.includes("as has_role_manager")) {
      return { rowCount: 1, rows: [{ has_role_manager: this.options.hasRoleManager ?? true }] };
    }

    if (query.includes('from "authorization"."role"')) {
      return { rowCount: 1, rows: [this.role] };
    }

    return { rowCount: 0, rows: [] };
  }

  release() {
    this.released = true;
  }
}

function createRepository(
  role: RoleRow,
  options?: ConstructorParameters<typeof RoleMutationClient>[1],
) {
  const client = new RoleMutationClient(role, options);

  return {
    client,
    repository: new AuthorizationRolesRepository({
      connect: async () => client,
      query: async () => ({ rowCount: 0, rows: [] }),
    }),
  };
}

test("does not deactivate system roles or remove app.access from Estándar", async () => {
  const systemRole: RoleRow = {
    role_description: "Default role.",
    role_is_active: true,
    role_is_default: true,
    role_key: "estandar",
    role_kind: "system",
    role_name: "Estándar",
  };
  const deactivation = createRepository(systemRole);
  const permissionRemoval = createRepository(systemRole);

  await assert.rejects(
    () =>
      deactivation.repository.updateRole(
        "estandar",
        {
          description: "Default role.",
          isActive: false,
          name: "Estándar",
          permissionKeys: ["app.access"],
        },
        null,
      ),
    AuthorizationRoleMutationError,
  );
  await assert.rejects(
    () =>
      permissionRemoval.repository.updateRole(
        "estandar",
        {
          description: "Default role.",
          name: "Estándar",
          permissionKeys: [],
        },
        null,
      ),
    AuthorizationRoleMutationError,
  );
  assert.equal(deactivation.client.auditEventCount, 0);
  assert.equal(permissionRemoval.client.auditEventCount, 0);
  assert.equal(deactivation.client.released, true);
  assert.equal(permissionRemoval.client.released, true);
});

test("does not delete assigned custom roles", async () => {
  const { client, repository } = createRepository(
    {
      role_description: "Custom role.",
      role_is_active: true,
      role_is_default: false,
      role_key: "custom-role",
      role_kind: "custom",
      role_name: "Custom role",
    },
    { hasAssignments: true },
  );

  await assert.rejects(
    () => repository.deleteCustomRole("custom-role", null),
    AuthorizationRoleMutationError,
  );
  assert.equal(client.auditEventCount, 0);
});

test("does not remove the last active authorization manager", async () => {
  const { client, repository } = createRepository(
    {
      role_description: "Custom role.",
      role_is_active: true,
      role_is_default: false,
      role_key: "custom-role",
      role_kind: "custom",
      role_name: "Custom role",
    },
    { hasRoleManager: false },
  );

  await assert.rejects(
    () =>
      repository.updateRole(
        "custom-role",
        {
          description: "Custom role.",
          name: "Custom role",
          permissionKeys: [],
        },
        null,
      ),
    AuthorizationRoleMutationError,
  );
  assert.equal(client.auditEventCount, 0);
});
