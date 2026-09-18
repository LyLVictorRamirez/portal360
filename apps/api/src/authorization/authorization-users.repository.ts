import { Inject, Injectable } from "@nestjs/common";

import { AUTHORIZATION_DATABASE } from "./authorization.repository.js";
import type {
  AuthorizationRole,
  AuthorizationRoleKind,
  AuthorizationUser,
} from "./authorization.types.js";

interface AuthorizationUsersQueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

interface AuthorizationUsersTransaction {
  query(query: string, values?: unknown[]): Promise<AuthorizationUsersQueryResult>;
  release(): void;
}

interface AuthorizationUsersDatabase {
  connect(): Promise<AuthorizationUsersTransaction>;
  query(query: string, values?: unknown[]): Promise<AuthorizationUsersQueryResult>;
}

export class AuthorizationUserNotFoundError extends Error {}

export class AuthorizationRoleAssignmentError extends Error {}

const listUsersQuery = `
  select
    user_record."id" as user_id,
    user_record."name" as user_name,
    user_record."email" as user_email,
    user_record."emailVerified" as user_email_verified,
    role."key" as role_key,
    role."name" as role_name,
    role."description" as role_description,
    role."kind" as role_kind,
    role."is_active" as role_is_active,
    role."is_default" as role_is_default
  from "auth"."user" user_record
  left join "authorization"."user_role" user_role
    on user_role."user_id" = user_record."id"
  left join "authorization"."role" role on role."key" = user_role."role_key"
  where (
    $1 = ''
    or user_record."name" ilike '%' || $1 || '%'
    or user_record."email" ilike '%' || $1 || '%'
  )
  order by user_record."name", user_record."email", role."name" nulls last
`;

const findUserForUpdateQuery = `
  select "id"
  from "auth"."user"
  where "id" = $1
  for update
`;

const findActiveRolesQuery = `
  select
    "key" as role_key,
    "name" as role_name,
    "description" as role_description,
    "kind" as role_kind,
    "is_active" as role_is_active,
    "is_default" as role_is_default
  from "authorization"."role"
  where "key" = any($1::text[]) and "is_active" = true
  order by "key"
  for update
`;

const deleteUserRolesQuery = `
  delete from "authorization"."user_role"
  where "user_id" = $1
`;

const insertUserRolesQuery = `
  insert into "authorization"."user_role" ("user_id", "role_key")
  select $1, unnest($2::text[])
  on conflict ("user_id", "role_key") do nothing
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

@Injectable()
export class AuthorizationUsersRepository {
  constructor(
    @Inject(AUTHORIZATION_DATABASE)
    private readonly database: AuthorizationUsersDatabase,
  ) {}

  async listUsers(search: string): Promise<AuthorizationUser[]> {
    const result = await this.database.query(listUsersQuery, [search.trim()]);

    return readAuthorizationUsers(result.rows);
  }

  async replaceUserRoles(userId: string, roleKeys: string[]): Promise<AuthorizationRole[]> {
    const uniqueRoleKeys = [...new Set(roleKeys)];

    if (uniqueRoleKeys.length !== roleKeys.length) {
      throw new AuthorizationRoleAssignmentError("Role keys cannot be repeated.");
    }

    if (uniqueRoleKeys.length === 0) {
      throw new AuthorizationRoleAssignmentError("A user must retain at least one active role.");
    }

    const client = await this.database.connect();

    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(360006)");

      const userResult = await client.query(findUserForUpdateQuery, [userId]);

      if (userResult.rowCount !== 1) {
        throw new AuthorizationUserNotFoundError(`User ${userId} does not exist.`);
      }

      const roleResult = await client.query(findActiveRolesQuery, [uniqueRoleKeys]);

      if (roleResult.rows.length !== uniqueRoleKeys.length) {
        throw new AuthorizationRoleAssignmentError("Every assigned role must exist and be active.");
      }

      await client.query(deleteUserRolesQuery, [userId]);
      await client.query(insertUserRolesQuery, [userId, uniqueRoleKeys]);

      const managerResult = await client.query(hasRoleManagerQuery);

      if (managerResult.rows[0]?.has_role_manager !== true) {
        throw new AuthorizationRoleAssignmentError(
          "At least one active user must retain authorization.roles.manage.",
        );
      }

      await client.query("COMMIT");

      return roleResult.rows.map(readAuthorizationRole);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

function readAuthorizationUsers(rows: Record<string, unknown>[]): AuthorizationUser[] {
  const users = new Map<string, AuthorizationUser>();

  for (const row of rows) {
    const id = readString(row.user_id, "user id");
    let user = users.get(id);

    if (!user) {
      user = {
        email: readString(row.user_email, "user email"),
        emailVerified: readBoolean(row.user_email_verified, "user email verification"),
        id,
        name: readString(row.user_name, "user name"),
        roles: [],
      };
      users.set(id, user);
    }

    if (typeof row.role_key === "string") {
      user.roles.push(readAuthorizationRole(row));
    }
  }

  return [...users.values()];
}

function readAuthorizationRole(row: Record<string, unknown>): AuthorizationRole {
  return {
    description: readString(row.role_description, "role description"),
    isActive: readBoolean(row.role_is_active, "role active state"),
    isDefault: readBoolean(row.role_is_default, "role default state"),
    key: readString(row.role_key, "role key"),
    kind: readRoleKind(row.role_kind),
    name: readString(row.role_name, "role name"),
  };
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
