import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readBusinessMigrations, runBusinessMigrations } from "./migrate.js";

test("defines the business client schema and initial CLI-001 configuration", async () => {
  const migrations = await readBusinessMigrations();

  assert.deepEqual(
    migrations.map((migration) => migration.name),
    [
      "0003-business-clients.sql",
      "0004-business-projects-and-code-settings.sql",
      "0005-business-requirements-and-code-settings.sql",
      "0006-business-unified-project-and-requirement-statuses.sql",
      "0007-business-tickets.sql",
    ],
  );

  const migration = migrations[0];

  assert.ok(migration);

  assert.match(migration.sql, /create extension if not exists pgcrypto/i);
  assert.match(migration.sql, /create schema if not exists "business"/i);

  for (const table of ["client", "client_code_settings"]) {
    assert.match(migration.sql, new RegExp(`create table "business"\\."${table}"`, "i"));
  }

  assert.match(migration.sql, /"id" uuid primary key default gen_random_uuid\(\)/i);
  assert.match(migration.sql, /"code" varchar\(21\) not null unique/i);
  assert.match(migration.sql, /client_prevent_code_mutation/i);
  assert.match(migration.sql, /client_name_trimmed_check/i);
  assert.match(migration.sql, /client_version_positive_check/i);
  assert.match(migration.sql, /on delete restrict/i);
  assert.match(migration.sql, /"prefix" ~ '\^\[A-Z0-9\]\{1,10\}\$'/);
  assert.match(migration.sql, /"code_length" between 3 and 20/i);
  assert.match(migration.sql, /"next_sequence" > 0/i);
  assert.match(migration.sql, /client_code_settings_enforce_lifecycle/i);
  assert.match(migration.sql, /values \(true, 'CLI', 6, 1\)\s*on conflict \("id"\) do nothing/i);
  assert.doesNotMatch(migration.sql, /"authorization"/i);
});

test("migrates client code settings and defines the project schema", async () => {
  const migrations = await readBusinessMigrations();
  const migration = migrations.find(
    ({ name }) => name === "0004-business-projects-and-code-settings.sql",
  );

  assert.ok(migration);
  assert.match(migration.sql, /create table "business"\."entity_code_settings"/i);
  assert.match(migration.sql, /"entity_type" in \('client', 'project'\)/i);
  assert.match(
    migration.sql,
    /insert into "business"\."entity_code_settings"[\s\S]*from "business"\."client_code_settings"/i,
  );
  assert.match(migration.sql, /values \('project', 'PRY', 6, 1\)/i);
  assert.match(migration.sql, /drop table "business"\."client_code_settings"/i);
  assert.match(migration.sql, /entity_code_settings_enforce_lifecycle/i);
  assert.match(migration.sql, /create table "business"\."project"/i);
  assert.match(migration.sql, /"client_id" uuid not null references "business"\."client"/i);
  assert.match(migration.sql, /"code" varchar\(21\) not null unique/i);
  assert.match(migration.sql, /"committed_end_date" >= "start_date"/i);
  assert.match(
    migration.sql,
    /"status" in \('planned', 'active', 'paused', 'finalized', 'cancelled'\)/i,
  );
  assert.match(migration.sql, /project_version_positive_check/i);
  assert.match(migration.sql, /project_prevent_identity_mutation/i);
  assert.match(migration.sql, /on delete restrict/i);
  assert.doesNotMatch(migration.sql, /alter table "business"\."client"/i);
  assert.doesNotMatch(migration.sql, /update "business"\."client"[\s\S]*"code"/i);
});

test("adds requirement code settings and schema without changing existing settings", async () => {
  const migrations = await readBusinessMigrations();
  const migration = migrations.find(
    ({ name }) => name === "0005-business-requirements-and-code-settings.sql",
  );

  assert.ok(migration);
  assert.match(migration.sql, /drop constraint "entity_code_settings_type_check"/i);
  assert.match(migration.sql, /"entity_type" in \('client', 'project', 'requirement'\)/i);
  assert.match(
    migration.sql,
    /values \('requirement', 'REQ', 6, 1\)\s*on conflict \("entity_type"\) do nothing/i,
  );
  assert.match(migration.sql, /create table "business"\."requirement"/i);
  assert.match(migration.sql, /"client_id" uuid not null references "business"\."client"/i);
  assert.match(migration.sql, /"code" varchar\(21\) not null unique/i);
  assert.match(migration.sql, /requirement_optional_dates_check/i);
  assert.match(
    migration.sql,
    /"status" in \([\s\S]*'new',[\s\S]*'in_analysis',[\s\S]*'quoted',[\s\S]*'approved',[\s\S]*'in_execution',[\s\S]*'closed',[\s\S]*'cancelled'/i,
  );
  assert.match(migration.sql, /requirement_status_dates_check/i);
  assert.match(migration.sql, /requirement_prevent_identity_mutation/i);
  assert.match(migration.sql, /on delete restrict/i);
  assert.doesNotMatch(migration.sql, /update "business"\."entity_code_settings"/i);
  assert.doesNotMatch(migration.sql, /delete from "business"\."entity_code_settings"/i);
});

test("defines the ticket schema without changing existing business entities", async () => {
  const migrations = await readBusinessMigrations();
  const migration = migrations.find(({ name }) => name === "0007-business-tickets.sql");

  assert.ok(migration);
  assert.match(migration.sql, /create table "business"\."ticket"/i);
  assert.match(migration.sql, /"client_id" uuid not null references "business"\."client"/i);
  assert.match(migration.sql, /"external_reference" varchar\(200\) not null/i);
  assert.doesNotMatch(migration.sql, /unique/i);
  assert.match(migration.sql, /"external_url" varchar\(2048\)/i);
  assert.match(migration.sql, /ticket_external_url_format_check/i);
  assert.match(migration.sql, /"title" varchar\(200\) not null/i);
  assert.match(migration.sql, /"description" varchar\(2000\)/i);
  assert.match(migration.sql, /"external_priority" text not null default 'medium'/i);
  assert.match(migration.sql, /"external_priority" in \('critical', 'high', 'medium', 'low'\)/i);
  assert.match(migration.sql, /ticket_version_positive_check/i);
  assert.match(migration.sql, /ticket_prevent_client_mutation/i);
  assert.match(migration.sql, /on delete restrict/i);
  assert.doesNotMatch(migration.sql, /"(?:code|status)"/i);
  assert.match(migration.sql, /"version" integer not null default 1/i);
  assert.match(migration.sql, /"external_reference" = btrim\("external_reference"\)/i);
  assert.match(migration.sql, /"title" = btrim\("title"\)/i);
  assert.doesNotMatch(migration.sql, /alter table "business"\."(?:client|project|requirement)"/i);
  assert.doesNotMatch(migration.sql, /update "business"\."(?:client|project|requirement)"/i);
});

test("reads only business migrations in filename order", async () => {
  const directory = await mkdtemp(join(tmpdir(), "portal-360-business-migrations-"));

  try {
    await writeFile(join(directory, "0004-business-later.sql"), "later migration");
    await writeFile(join(directory, "0003-business-clients.sql"), "client migration");
    await writeFile(join(directory, "0003-authorization-rbac.sql"), "authorization migration");
    await writeFile(join(directory, "0003-business-invalid_name.sql"), "invalid migration");
    await mkdir(join(directory, "0005-business-directory.sql"));

    const migrations = await readBusinessMigrations(directory);

    assert.deepEqual(
      migrations.map((migration) => migration.name),
      ["0003-business-clients.sql", "0004-business-later.sql"],
    );
    assert.deepEqual(
      migrations.map((migration) => migration.sql),
      ["client migration", "later migration"],
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("applies only pending business migrations in one transaction", async () => {
  const queries: Array<{ query: string; values?: unknown[] }> = [];
  let released = false;
  const client = {
    async query(query: string, values?: unknown[]) {
      queries.push({ query, values });

      if (query.includes('SELECT "name" FROM "business"."schema_migration"')) {
        return { rowCount: 1, rows: [{ name: "0003-business-clients.sql" }] };
      }

      return { rowCount: 0, rows: [] };
    },
    release() {
      released = true;
    },
  };
  const pool = {
    connect: async () => client,
  } as Parameters<typeof runBusinessMigrations>[0];

  const applied = await runBusinessMigrations(pool, [
    { name: "0003-business-clients.sql", sql: "already applied" },
    { name: "0004-business-next.sql", sql: "pending migration" },
  ]);

  assert.deepEqual(applied, ["0004-business-next.sql"]);
  assert.equal(queries[0]?.query, "BEGIN");
  assert.equal(
    queries.some((entry) => entry.query === 'CREATE SCHEMA IF NOT EXISTS "business"'),
    true,
  );
  assert.equal(
    queries.some((entry) => entry.query.includes('"business"."schema_migration"')),
    true,
  );
  assert.equal(
    queries.some((entry) => entry.query.includes("pg_advisory_xact_lock(360006)")),
    true,
  );
  assert.equal(
    queries.some((entry) => entry.query === "pending migration"),
    true,
  );
  assert.equal(
    queries.some((entry) => entry.query === "already applied"),
    false,
  );
  assert.deepEqual(
    queries.find((entry) => entry.query.includes('INSERT INTO "business"."schema_migration"'))
      ?.values,
    ["0004-business-next.sql"],
  );
  assert.equal(queries.at(-1)?.query, "COMMIT");
  assert.equal(released, true);
  assert.equal(
    queries.some(
      (entry) => entry.query.includes('"authorization"') || entry.query.includes('"auth"'),
    ),
    false,
  );
});

test("rolls back a failed business migration without recording it", async () => {
  const queries: Array<{ query: string; values?: unknown[] }> = [];
  let released = false;
  const client = {
    async query(query: string, values?: unknown[]) {
      queries.push({ query, values });

      if (query === "invalid migration") {
        throw new Error("migration failed");
      }

      if (query.includes('SELECT "name" FROM "business"."schema_migration"')) {
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    },
    release() {
      released = true;
    },
  };
  const pool = {
    connect: async () => client,
  } as Parameters<typeof runBusinessMigrations>[0];

  await assert.rejects(
    () =>
      runBusinessMigrations(pool, [
        { name: "0003-business-clients.sql", sql: "invalid migration" },
      ]),
    /migration failed/,
  );

  assert.equal(
    queries.some((entry) => entry.query === "ROLLBACK"),
    true,
  );
  assert.equal(
    queries.some((entry) => entry.query.includes('INSERT INTO "business"."schema_migration"')),
    false,
  );
  assert.equal(released, true);
});
