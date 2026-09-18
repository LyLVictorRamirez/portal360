import { Inject, Injectable } from "@nestjs/common";

import { isAuthorizationPermission } from "./permissions.js";
import type {
  AuthorizationRole,
  AuthorizationRoleKind,
  UserAuthorization,
} from "./authorization.types.js";

export const AUTHORIZATION_DATABASE = Symbol("AUTHORIZATION_DATABASE");

interface AuthorizationRolePermissionRow {
  permission_key: string | null;
  role_description: string;
  role_is_active: boolean;
  role_is_default: boolean;
  role_key: string;
  role_kind: string;
  role_name: string;
}

export interface AuthorizationQueryExecutor {
  query(query: string, values: unknown[]): Promise<{ rows: AuthorizationRolePermissionRow[] }>;
}

const userAuthorizationQuery = `
  select
    role."key" as role_key,
    role."name" as role_name,
    role."description" as role_description,
    role."kind" as role_kind,
    role."is_active" as role_is_active,
    role."is_default" as role_is_default,
    role_permission."permission_key" as permission_key
  from "authorization"."user_role" user_role
  inner join "authorization"."role" role on role."key" = user_role."role_key"
  left join "authorization"."role_permission" role_permission
    on role_permission."role_key" = role."key"
  where user_role."user_id" = $1 and role."is_active" = true
  order by role."key", role_permission."permission_key"
`;

@Injectable()
export class AuthorizationRepository {
  constructor(
    @Inject(AUTHORIZATION_DATABASE)
    private readonly database: AuthorizationQueryExecutor,
  ) {}

  async findUserAuthorization(userId: string): Promise<UserAuthorization> {
    const result = await this.database.query(userAuthorizationQuery, [userId]);
    const roles = new Map<string, AuthorizationRole>();
    const permissions = new Set<UserAuthorization["permissions"][number]>();

    for (const row of result.rows) {
      if (!roles.has(row.role_key)) {
        roles.set(row.role_key, {
          description: row.role_description,
          isActive: row.role_is_active,
          isDefault: row.role_is_default,
          key: row.role_key,
          kind: readRoleKind(row.role_kind),
          name: row.role_name,
        });
      }

      if (row.permission_key) {
        if (!isAuthorizationPermission(row.permission_key)) {
          throw new Error(`Unknown authorization permission: ${row.permission_key}`);
        }

        permissions.add(row.permission_key);
      }
    }

    return {
      permissions: [...permissions],
      roles: [...roles.values()],
    };
  }
}

function readRoleKind(kind: string): AuthorizationRoleKind {
  if (kind === "custom" || kind === "system") {
    return kind;
  }

  throw new Error(`Unknown authorization role kind: ${kind}`);
}
