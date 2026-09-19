import { Pool } from "pg";

import {
  type AuthorizationMutationExecutor,
  type AuthorizationMutationResult,
} from "./authorization-assignments.js";
import { loadEnvironment } from "../config/environment.js";

export interface AuthorizationBootstrapClient extends AuthorizationMutationExecutor {
  release(): void;
}

export interface AuthorizationBootstrapDatabase {
  connect(): Promise<AuthorizationBootstrapClient>;
}

export interface BootstrapAdministratorResult {
  assigned: boolean;
  email: string;
  userId: string;
}

const findVerifiedUserQuery = `
  select "id", "emailVerified"
  from "auth"."user"
  where lower("email") = $1
  for update
`;

const assignAdministratorRoleQuery = `
  insert into "authorization"."user_role" ("user_id", "role_key")
  values ($1, 'administrador')
  on conflict ("user_id", "role_key") do nothing
`;

const recordBootstrapAuditEventQuery = `
  insert into "authorization"."audit_event" (
    "event_type",
    "actor_user_id",
    "subject_type",
    "subject_key",
    "before_state",
    "after_state"
  )
  values (
    'authorization.bootstrap_admin',
    null,
    'user_role',
    $2,
    null,
    jsonb_build_object('userId', $1::text, 'roleKey', 'administrador')
  )
`;

export async function bootstrapAdministrator(
  database: AuthorizationBootstrapDatabase,
  email: string,
): Promise<BootstrapAdministratorResult> {
  const normalizedEmail = normalizeEmail(email);
  const client = await database.connect();

  try {
    await client.query("BEGIN");
    const userResult = await client.query(findVerifiedUserQuery, [normalizedEmail]);
    const user = readVerifiedUser(userResult, normalizedEmail);
    const assignmentResult = await client.query(assignAdministratorRoleQuery, [user.id]);
    const assigned = assignmentResult.rowCount === 1;

    if (assigned) {
      await client.query(recordBootstrapAuditEventQuery, [user.id, `${user.id}:administrador`]);
    }

    await client.query("COMMIT");

    return {
      assigned,
      email: normalizedEmail,
      userId: user.id,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function readBootstrapEmailArgument(arguments_: string[]): string {
  if (arguments_.length !== 1) {
    throw new Error("Usage: pnpm authorization:bootstrap-admin -- <verified-email>");
  }

  return normalizeEmail(arguments_[0]);
}

function normalizeEmail(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("A verified email is required to bootstrap an administrator.");
  }

  return normalizedEmail;
}

function readVerifiedUser(result: AuthorizationMutationResult, email: string): { id: string } {
  const user = result.rows[0];

  if (!user || typeof user.id !== "string") {
    throw new Error(`No user exists for ${email}.`);
  }

  if (user.emailVerified !== true) {
    throw new Error(`The user ${email} must verify their email before becoming an administrator.`);
  }

  return { id: user.id };
}

async function main(): Promise<void> {
  const email = readBootstrapEmailArgument(process.argv.slice(2));
  const environment = loadEnvironment();
  const pool = new Pool({ connectionString: environment.databaseUrl });

  try {
    const result = await bootstrapAdministrator(pool, email);
    const status = result.assigned ? "assigned" : "already assigned";

    console.log(`Administrator role ${status} for ${result.email}.`);
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1]?.endsWith("bootstrap-admin.ts") ||
  process.argv[1]?.endsWith("bootstrap-admin.js")
) {
  void main().catch((error: unknown) => {
    console.error("Administrator bootstrap failed.", error);
    process.exitCode = 1;
  });
}
