import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { Pool } from "pg";

import { loadEnvironment } from "../config/environment.js";

const migrationFilePattern = /^\d{4}-authorization-[a-z0-9][a-z0-9-]*\.sql$/;
const migrationsDirectory = join(process.cwd(), "migrations");

interface AuthorizationMigration {
  name: string;
  sql: string;
}

export async function readAuthorizationMigrations(
  directory = migrationsDirectory,
): Promise<AuthorizationMigration[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const migrationNames = entries
    .filter((entry) => entry.isFile() && migrationFilePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    migrationNames.map(async (name) => ({
      name,
      sql: await readFile(join(directory, name), "utf8"),
    })),
  );
}

export async function runAuthorizationMigrations(
  pool: Pool,
  migrations?: AuthorizationMigration[],
): Promise<string[]> {
  const migrationsToRun = migrations ?? (await readAuthorizationMigrations());
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query('CREATE SCHEMA IF NOT EXISTS "authorization"');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "authorization"."schema_migration" (
        "name" text PRIMARY KEY,
        "applied_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query("SELECT pg_advisory_xact_lock(360005)");

    const appliedResult = await client.query<{ name: string }>(
      'SELECT "name" FROM "authorization"."schema_migration"',
    );
    const appliedNames = new Set(appliedResult.rows.map((row) => row.name));
    const pendingMigrations = migrationsToRun.filter(
      (migration) => !appliedNames.has(migration.name),
    );

    for (const migration of pendingMigrations) {
      await client.query(migration.sql);
      await client.query('INSERT INTO "authorization"."schema_migration" ("name") VALUES ($1)', [
        migration.name,
      ]);
    }

    await client.query("COMMIT");

    return pendingMigrations.map((migration) => migration.name);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const environment = loadEnvironment();
  const pool = new Pool({ connectionString: environment.databaseUrl });

  try {
    const appliedMigrations = await runAuthorizationMigrations(pool);

    if (appliedMigrations.length === 0) {
      console.log("Authorization migrations are up to date.");
      return;
    }

    console.log(`Applied authorization migrations: ${appliedMigrations.join(", ")}`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  void main().catch((error: unknown) => {
    console.error("Authorization migration failed.", error);
    process.exitCode = 1;
  });
}
