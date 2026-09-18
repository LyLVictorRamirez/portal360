export interface AuthorizationMutationResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface AuthorizationMutationExecutor {
  query(query: string, values?: unknown[]): Promise<AuthorizationMutationResult>;
}

const assignDefaultRoleQuery = `
  insert into "authorization"."user_role" ("user_id", "role_key")
  select $1, role."key"
  from "authorization"."role" role
  where role."key" = 'estandar' and role."is_active" = true
  on conflict ("user_id", "role_key") do nothing
`;

const findDefaultRoleAssignmentQuery = `
  select 1
  from "authorization"."user_role"
  where "user_id" = $1 and "role_key" = 'estandar'
`;

export async function assignDefaultRole(
  database: AuthorizationMutationExecutor,
  userId: string,
): Promise<boolean> {
  const result = await database.query(assignDefaultRoleQuery, [userId]);

  if (result.rowCount === 1) {
    return true;
  }

  const existingAssignment = await database.query(findDefaultRoleAssignmentQuery, [userId]);

  if (existingAssignment.rowCount === 1) {
    return false;
  }

  throw new Error("The standard authorization role is unavailable.");
}
