import assert from "node:assert/strict";
import test from "node:test";

import { readAuthorizationMigrations, runAuthorizationMigrations } from "./migrate.js";

test("keeps the RBAC schema, catalog, and system-role safeguards in the authorization migration", async () => {
  const migrations = await readAuthorizationMigrations();

  assert.deepEqual(
    migrations.map((migration) => migration.name),
    [
      "0002-authorization-rbac.sql",
      "0003-authorization-clients-permissions.sql",
      "0004-authorization-projects-permissions.sql",
    ],
  );

  const [migration] = migrations;

  for (const table of [
    "permission",
    "role",
    "role_permission",
    "user_role",
    "audit_event",
    "schema_migration",
  ]) {
    assert.match(migration.sql, new RegExp(`"authorization"\\."${table}"`));
  }

  for (const permission of [
    "app.access",
    "authorization.users.read",
    "authorization.users.manage",
    "authorization.roles.read",
    "authorization.roles.manage",
  ]) {
    assert.match(migration.sql, new RegExp(`'${permission}'`));
  }

  for (const role of ["administrador", "lider", "miembro", "estandar"]) {
    assert.match(migration.sql, new RegExp(`'${role}'`));
  }

  assert.match(migration.sql, /role_permission_requires_standard_access/);
  assert.match(migration.sql, /audit_event_prevent_mutation/);
  assert.doesNotMatch(migration.sql, /alter table "auth"/i);
});

test("adds idempotent Client permissions with the agreed system-role grants", async () => {
  const migrations = await readAuthorizationMigrations();
  const migration = migrations.find(
    (candidate) => candidate.name === "0003-authorization-clients-permissions.sql",
  );

  assert.ok(migration);

  for (const permission of ["clients.read", "clients.manage", "clients.settings.manage"]) {
    assert.match(migration.sql, new RegExp(`'${permission}'`));
  }

  for (const grant of [
    ["administrador", "clients.read"],
    ["administrador", "clients.manage"],
    ["administrador", "clients.settings.manage"],
    ["lider", "clients.read"],
    ["lider", "clients.manage"],
    ["miembro", "clients.read"],
  ]) {
    assert.match(migration.sql, new RegExp(`\\('${grant[0]}', '${grant[1]}'\\)`));
  }

  assert.match(migration.sql, /on conflict \("key"\) do nothing/i);
  assert.match(migration.sql, /on conflict \("role_key", "permission_key"\) do nothing/i);
  assert.match(migration.sql, /update "authorization"\."role"/i);
  assert.doesNotMatch(migration.sql, /delete from "authorization"/i);
});

test("adds idempotent Project permissions with the agreed system-role grants", async () => {
  const migrations = await readAuthorizationMigrations();
  const migration = migrations.find(
    (candidate) => candidate.name === "0004-authorization-projects-permissions.sql",
  );

  assert.ok(migration);

  for (const permission of ["projects.read", "projects.manage", "projects.settings.manage"]) {
    assert.match(migration.sql, new RegExp(`'${permission}'`));
  }

  for (const grant of [
    ["administrador", "projects.read"],
    ["administrador", "projects.manage"],
    ["administrador", "projects.settings.manage"],
    ["lider", "projects.read"],
    ["lider", "projects.manage"],
    ["miembro", "projects.read"],
  ]) {
    assert.match(migration.sql, new RegExp(`\\('${grant[0]}', '${grant[1]}'\\)`));
  }

  assert.match(migration.sql, /on conflict \("key"\) do nothing/i);
  assert.match(migration.sql, /on conflict \("role_key", "permission_key"\) do nothing/i);
  assert.doesNotMatch(migration.sql, /update "authorization"/i);
  assert.doesNotMatch(migration.sql, /delete from "authorization"/i);
});

test("applies only pending authorization migrations in one transaction", async () => {
  const queries: Array<{ query: string; values?: unknown[] }> = [];
  let released = false;
  const client = {
    async query(query: string, values?: unknown[]) {
      queries.push({ query, values });

      if (query.includes('SELECT "name" FROM "authorization"."schema_migration"')) {
        return { rowCount: 1, rows: [{ name: "0002-authorization-rbac.sql" }] };
      }

      return { rowCount: 0, rows: [] };
    },
    release() {
      released = true;
    },
  };
  const pool = {
    connect: async () => client,
  } as Parameters<typeof runAuthorizationMigrations>[0];

  const applied = await runAuthorizationMigrations(pool, [
    { name: "0002-authorization-rbac.sql", sql: "already applied" },
    { name: "0003-authorization-next.sql", sql: "pending migration" },
  ]);

  assert.deepEqual(applied, ["0003-authorization-next.sql"]);
  assert.equal(queries[0]?.query, "BEGIN");
  assert.equal(
    queries.some((entry) => entry.query === "pending migration"),
    true,
  );
  assert.equal(
    queries.some((entry) => entry.query === "already applied"),
    false,
  );
  assert.deepEqual(
    queries.find((entry) => entry.query.includes('INSERT INTO "authorization"."schema_migration"'))
      ?.values,
    ["0003-authorization-next.sql"],
  );
  assert.equal(queries.at(-1)?.query, "COMMIT");
  assert.equal(released, true);
});

test("rolls back a failed authorization migration without recording it", async () => {
  const queries: Array<{ query: string; values?: unknown[] }> = [];
  let released = false;
  const client = {
    async query(query: string, values?: unknown[]) {
      queries.push({ query, values });

      if (query === "invalid migration") {
        throw new Error("migration failed");
      }

      if (query.includes('SELECT "name" FROM "authorization"."schema_migration"')) {
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
  } as Parameters<typeof runAuthorizationMigrations>[0];

  await assert.rejects(
    () =>
      runAuthorizationMigrations(pool, [
        { name: "0003-authorization-next.sql", sql: "invalid migration" },
      ]),
    /migration failed/,
  );

  assert.equal(
    queries.some((entry) => entry.query === "ROLLBACK"),
    true,
  );
  assert.equal(
    queries.some((entry) => entry.query.includes('INSERT INTO "authorization"."schema_migration"')),
    false,
  );
  assert.equal(released, true);
});
