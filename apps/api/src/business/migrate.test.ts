import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readBusinessMigrations, runBusinessMigrations } from "./migrate.js";

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
  assert.equal(queries.some((entry) => entry.query === 'CREATE SCHEMA IF NOT EXISTS "business"'), true);
  assert.equal(
    queries.some((entry) => entry.query.includes('"business"."schema_migration"')),
    true,
  );
  assert.equal(
    queries.some((entry) => entry.query.includes("pg_advisory_xact_lock(360006)")),
    true,
  );
  assert.equal(queries.some((entry) => entry.query === "pending migration"), true);
  assert.equal(queries.some((entry) => entry.query === "already applied"), false);
  assert.deepEqual(
    queries.find((entry) => entry.query.includes('INSERT INTO "business"."schema_migration"'))
      ?.values,
    ["0004-business-next.sql"],
  );
  assert.equal(queries.at(-1)?.query, "COMMIT");
  assert.equal(released, true);
  assert.equal(
    queries.some((entry) => entry.query.includes('"authorization"') || entry.query.includes('"auth"')),
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
    () => runBusinessMigrations(pool, [{ name: "0003-business-clients.sql", sql: "invalid migration" }]),
    /migration failed/,
  );

  assert.equal(queries.some((entry) => entry.query === "ROLLBACK"), true);
  assert.equal(
    queries.some((entry) => entry.query.includes('INSERT INTO "business"."schema_migration"')),
    false,
  );
  assert.equal(released, true);
});
