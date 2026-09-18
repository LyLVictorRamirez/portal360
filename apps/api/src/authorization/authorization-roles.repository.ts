import { Inject, Injectable } from "@nestjs/common";

import { recordAuthorizationAuditEvent } from "./authorization-audit.js";
import { AUTHORIZATION_DATABASE } from "./authorization.repository.js";
import { isAuthorizationPermission, type AuthorizationPermission } from "./permissions.js";
import type {
  AuthorizationPermissionDefinition,
  AuthorizationRoleDetails,
  AuthorizationRoleKind,
} from "./authorization.types.js";

interface AuthorizationRolesQueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

interface AuthorizationRolesTransaction {
  query(query: string, values?: unknown[]): Promise<AuthorizationRolesQueryResult>;
  release(): void;
}

interface AuthorizationRolesDatabase {
  connect(): Promise<AuthorizationRolesTransaction>;
  query(query: string, values?: unknown[]): Promise<AuthorizationRolesQueryResult>;
}

export interface CreateCustomRoleInput {
  description: string;
  key: string;
  name: string;
  permissionKeys: AuthorizationPermission[];
}

export interface UpdateRoleInput {
  description: string;
  isActive?: boolean;
  name: string;
  permissionKeys: AuthorizationPermission[];
}

export class AuthorizationRoleNotFoundError extends Error {}

export class AuthorizationRoleMutationError extends Error {}

const listRolesQuery = `
  select
    role."key" as role_key,
    role."name" as role_name,
    role."description" as role_description,
    role."kind" as role_kind,
    role."is_active" as role_is_active,
    role."is_default" as role_is_default,
    role_permission."permission_key" as permission_key
  from "authorization"."role" role
  left join "authorization"."role_permission" role_permission
    on role_permission."role_key" = role."key"
  order by role."key", role_permission."permission_key"
`;

const listPermissionsQuery = `
  select "key" as permission_key, "name" as permission_name, "description" as permission_description
  from "authorization"."permission"
  order by "key"
`;

const findRoleForUpdateQuery = `
  select
    "key" as role_key,
    "name" as role_name,
    "description" as role_description,
    "kind" as role_kind,
    "is_active" as role_is_active,
    "is_default" as role_is_default
  from "authorization"."role"
  where "key" = $1
  for update
`;

const findPermissionKeysQuery = `
  select "key" as permission_key
  from "authorization"."permission"
  where "key" = any($1::text[])
`;

const findRolePermissionKeysQuery = `
  select "permission_key"
  from "authorization"."role_permission"
  where "role_key" = $1
  order by "permission_key"
`;

const insertRoleQuery = `
  insert into "authorization"."role" (
    "key", "name", "description", "kind", "is_active", "is_default"
  )
  values ($1, $2, $3, 'custom', true, false)
`;

const updateRoleQuery = `
  update "authorization"."role"
  set "name" = $2,
      "description" = $3,
      "is_active" = coalesce($4, "is_active"),
      "updated_at" = current_timestamp
  where "key" = $1
`;

const removePermissionsNotInRoleQuery = `
  delete from "authorization"."role_permission"
  where "role_key" = $1 and "permission_key" <> all($2::text[])
`;

const addRolePermissionsQuery = `
  insert into "authorization"."role_permission" ("role_key", "permission_key")
  select $1, unnest($2::text[])
  on conflict ("role_key", "permission_key") do nothing
`;

const userWouldLoseLastActiveRoleQuery = `
  select exists (
    select 1
    from "authorization"."user_role" target_assignment
    where target_assignment."role_key" = $1
      and not exists (
        select 1
        from "authorization"."user_role" other_assignment
        inner join "authorization"."role" other_role
          on other_role."key" = other_assignment."role_key"
        where other_assignment."user_id" = target_assignment."user_id"
          and other_assignment."role_key" <> $1
          and other_role."is_active" = true
      )
  ) as would_lose_last_active_role
`;

const hasRoleManagerQuery = `
  select exists (
    select 1
    from "authorization"."user_role" user_role
    inner join "authorization"."role" role on role."key" = user_role."role_key"
    inner join "authorization"."role_permission" role_permission
      on role_permission."role_key" = role."key"
    where role."is_active" = true
      and role_permission."permission_key" = 'authorization.roles.manage'
  ) as has_role_manager
`;

const roleHasAssignmentsQuery = `
  select exists (
    select 1
    from "authorization"."user_role"
    where "role_key" = $1
  ) as has_assignments
`;

const deleteRoleQuery = `
  delete from "authorization"."role"
  where "key" = $1
`;

@Injectable()
export class AuthorizationRolesRepository {
  constructor(
    @Inject(AUTHORIZATION_DATABASE)
    private readonly database: AuthorizationRolesDatabase,
  ) {}

  async listRoleCatalog(): Promise<{
    permissions: AuthorizationPermissionDefinition[];
    roles: AuthorizationRoleDetails[];
  }> {
    const [roleResult, permissionResult] = await Promise.all([
      this.database.query(listRolesQuery),
      this.database.query(listPermissionsQuery),
    ]);

    return {
      permissions: permissionResult.rows.map(readPermissionDefinition),
      roles: readRoleDetails(roleResult.rows),
    };
  }

  async createCustomRole(
    input: CreateCustomRoleInput,
    actorUserId: string | null,
  ): Promise<AuthorizationRoleDetails> {
    const permissionKeys = validatePermissionKeys(input.permissionKeys);
    const client = await this.database.connect();

    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(360007)");
      const existingRole = await client.query(findRoleForUpdateQuery, [input.key]);

      if (existingRole.rowCount !== 0) {
        throw new AuthorizationRoleMutationError(`The role ${input.key} already exists.`);
      }

      await ensurePermissionKeysExist(client, permissionKeys);
      await client.query(insertRoleQuery, [input.key, input.name, input.description]);
      await client.query(addRolePermissionsQuery, [input.key, permissionKeys]);
      const createdRole = {
        description: input.description,
        isActive: true,
        isDefault: false,
        key: input.key,
        kind: "custom" as const,
        name: input.name,
        permissions: permissionKeys,
      };

      await recordAuthorizationAuditEvent(client, {
        actorUserId,
        afterState: createdRole,
        beforeState: null,
        eventType: "authorization.role.created",
        subjectKey: input.key,
        subjectType: "role",
      });

      for (const permissionKey of permissionKeys) {
        await recordAuthorizationAuditEvent(client, {
          actorUserId,
          afterState: { permissionKey, roleKey: input.key },
          beforeState: null,
          eventType: "authorization.role_permission.assigned",
          subjectKey: `${input.key}:${permissionKey}`,
          subjectType: "role_permission",
        });
      }

      await client.query("COMMIT");

      return createdRole;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateRole(
    roleKey: string,
    input: UpdateRoleInput,
    actorUserId: string | null,
  ): Promise<AuthorizationRoleDetails> {
    const permissionKeys = validatePermissionKeys(input.permissionKeys);
    const client = await this.database.connect();

    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(360007)");
      const roleResult = await client.query(findRoleForUpdateQuery, [roleKey]);
      const roleRow = roleResult.rows[0];

      if (!roleRow) {
        throw new AuthorizationRoleNotFoundError(`The role ${roleKey} does not exist.`);
      }

      const role = readRoleDetails([roleRow])[0];

      if (!role) {
        throw new Error("The authorization database returned an invalid role.");
      }

      const currentPermissionResult = await client.query(findRolePermissionKeysQuery, [roleKey]);
      const currentPermissionKeys = currentPermissionResult.rows.map((row) => {
        const key = readString(row.permission_key, "permission key");

        if (!isAuthorizationPermission(key)) {
          throw new Error("Invalid permission returned by the authorization database.");
        }

        return key;
      });
      const roleBefore = { ...role, permissions: currentPermissionKeys };

      if (role.kind === "system" && input.isActive === false) {
        throw new AuthorizationRoleMutationError("System roles cannot be deactivated.");
      }

      if (role.key === "estandar" && !permissionKeys.includes("app.access")) {
        throw new AuthorizationRoleMutationError("The standard role must retain app.access.");
      }

      if (role.isActive && input.isActive === false) {
        const activeRoleResult = await client.query(userWouldLoseLastActiveRoleQuery, [roleKey]);

        if (activeRoleResult.rows[0]?.would_lose_last_active_role === true) {
          throw new AuthorizationRoleMutationError(
            "Deactivating this role would leave a user without an active role.",
          );
        }
      }

      await ensurePermissionKeysExist(client, permissionKeys);
      await client.query(updateRoleQuery, [roleKey, input.name, input.description, input.isActive]);
      await client.query(removePermissionsNotInRoleQuery, [roleKey, permissionKeys]);
      await client.query(addRolePermissionsQuery, [roleKey, permissionKeys]);

      const managerResult = await client.query(hasRoleManagerQuery);

      if (managerResult.rows[0]?.has_role_manager !== true) {
        throw new AuthorizationRoleMutationError(
          "At least one active user must retain authorization.roles.manage.",
        );
      }

      const roleAfter = {
        description: input.description,
        isActive: input.isActive ?? role.isActive,
        isDefault: role.isDefault,
        key: role.key,
        kind: role.kind,
        name: input.name,
        permissions: permissionKeys,
      };
      const currentPermissionKeySet = new Set(currentPermissionKeys);
      const newPermissionKeySet = new Set(permissionKeys);

      if (roleBefore.name !== roleAfter.name || roleBefore.description !== roleAfter.description) {
        await recordAuthorizationAuditEvent(client, {
          actorUserId,
          afterState: roleAfter,
          beforeState: roleBefore,
          eventType: "authorization.role.updated",
          subjectKey: roleKey,
          subjectType: "role",
        });
      }

      if (roleBefore.isActive !== roleAfter.isActive) {
        await recordAuthorizationAuditEvent(client, {
          actorUserId,
          afterState: roleAfter,
          beforeState: roleBefore,
          eventType: roleAfter.isActive
            ? "authorization.role.activated"
            : "authorization.role.deactivated",
          subjectKey: roleKey,
          subjectType: "role",
        });
      }

      for (const permissionKey of currentPermissionKeys.filter(
        (key) => !newPermissionKeySet.has(key),
      )) {
        await recordAuthorizationAuditEvent(client, {
          actorUserId,
          afterState: null,
          beforeState: { permissionKey, roleKey },
          eventType: "authorization.role_permission.removed",
          subjectKey: `${roleKey}:${permissionKey}`,
          subjectType: "role_permission",
        });
      }

      for (const permissionKey of permissionKeys.filter(
        (key) => !currentPermissionKeySet.has(key),
      )) {
        await recordAuthorizationAuditEvent(client, {
          actorUserId,
          afterState: { permissionKey, roleKey },
          beforeState: null,
          eventType: "authorization.role_permission.assigned",
          subjectKey: `${roleKey}:${permissionKey}`,
          subjectType: "role_permission",
        });
      }

      await client.query("COMMIT");

      return roleAfter;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteCustomRole(roleKey: string, actorUserId: string | null): Promise<void> {
    const client = await this.database.connect();

    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(360007)");
      const roleResult = await client.query(findRoleForUpdateQuery, [roleKey]);
      const roleRow = roleResult.rows[0];

      if (!roleRow) {
        throw new AuthorizationRoleNotFoundError(`The role ${roleKey} does not exist.`);
      }

      const role = readRoleDetails([roleRow])[0];

      if (!role) {
        throw new Error("The authorization database returned an invalid role.");
      }

      const currentPermissionResult = await client.query(findRolePermissionKeysQuery, [roleKey]);
      const permissionKeys = currentPermissionResult.rows.map((row) => {
        const key = readString(row.permission_key, "permission key");

        if (!isAuthorizationPermission(key)) {
          throw new Error("Invalid permission returned by the authorization database.");
        }

        return key;
      });
      const roleBefore = { ...role, permissions: permissionKeys };

      if (role.kind === "system") {
        throw new AuthorizationRoleMutationError("System roles cannot be deleted.");
      }

      const assignmentResult = await client.query(roleHasAssignmentsQuery, [roleKey]);

      if (assignmentResult.rows[0]?.has_assignments === true) {
        throw new AuthorizationRoleMutationError("Assigned custom roles cannot be deleted.");
      }

      await client.query(deleteRoleQuery, [roleKey]);
      await recordAuthorizationAuditEvent(client, {
        actorUserId,
        afterState: null,
        beforeState: roleBefore,
        eventType: "authorization.role.deleted",
        subjectKey: roleKey,
        subjectType: "role",
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

async function ensurePermissionKeysExist(
  database: AuthorizationRolesTransaction,
  permissionKeys: AuthorizationPermission[],
): Promise<void> {
  const result = await database.query(findPermissionKeysQuery, [permissionKeys]);

  if (result.rows.length !== permissionKeys.length) {
    throw new AuthorizationRoleMutationError(
      "Every role permission must exist in the fixed catalog.",
    );
  }
}

function readPermissionDefinition(row: Record<string, unknown>): AuthorizationPermissionDefinition {
  const key = readString(row.permission_key, "permission key");

  if (!isAuthorizationPermission(key)) {
    throw new Error("Invalid permission returned by the authorization database.");
  }

  return {
    description: readString(row.permission_description, "permission description"),
    key,
    name: readString(row.permission_name, "permission name"),
  };
}

function readRoleDetails(rows: Record<string, unknown>[]): AuthorizationRoleDetails[] {
  const roles = new Map<string, AuthorizationRoleDetails>();

  for (const row of rows) {
    const key = readString(row.role_key, "role key");
    let role = roles.get(key);

    if (!role) {
      role = {
        description: readString(row.role_description, "role description"),
        isActive: readBoolean(row.role_is_active, "role active state"),
        isDefault: readBoolean(row.role_is_default, "role default state"),
        key,
        kind: readRoleKind(row.role_kind),
        name: readString(row.role_name, "role name"),
        permissions: [],
      };
      roles.set(key, role);
    }

    if (typeof row.permission_key === "string") {
      if (!isAuthorizationPermission(row.permission_key)) {
        throw new Error("Invalid permission returned by the authorization database.");
      }

      role.permissions.push(row.permission_key);
    }
  }

  return [...roles.values()];
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${field} returned by the authorization database.`);
  }

  return value;
}

function readRoleKind(value: unknown): AuthorizationRoleKind {
  if (value === "custom" || value === "system") {
    return value;
  }

  throw new Error("Invalid role kind returned by the authorization database.");
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid ${field} returned by the authorization database.`);
  }

  return value;
}

function validatePermissionKeys(
  permissionKeys: AuthorizationPermission[],
): AuthorizationPermission[] {
  if (new Set(permissionKeys).size !== permissionKeys.length) {
    throw new AuthorizationRoleMutationError("Role permissions cannot be repeated.");
  }

  return [...permissionKeys].sort();
}
