import assert from "node:assert/strict";
import test from "node:test";

import {
  bootstrapAdministrator,
  readBootstrapEmailArgument,
  type AuthorizationBootstrapClient,
  type AuthorizationBootstrapDatabase,
} from "./bootstrap-admin.js";

class BootstrapClient implements AuthorizationBootstrapClient {
  readonly queries: Array<{ query: string; values: unknown[] | undefined }> = [];
  released = false;
  private assignmentAttempts = 0;

  constructor(private readonly user: Record<string, unknown> | undefined) {}

  async query(query: string, values?: unknown[]) {
    this.queries.push({ query, values });

    if (query.includes('from "auth"."user"')) {
      return {
        rowCount: this.user ? 1 : 0,
        rows: this.user ? [this.user] : [],
      };
    }

    if (query.includes('insert into "authorization"."user_role"')) {
      this.assignmentAttempts += 1;

      return {
        rowCount: this.assignmentAttempts === 1 ? 1 : 0,
        rows: [],
      };
    }

    return { rowCount: 0, rows: [] };
  }

  release() {
    this.released = true;
  }
}

class BootstrapDatabase implements AuthorizationBootstrapDatabase {
  readonly client: BootstrapClient;

  constructor(user: Record<string, unknown> | undefined) {
    this.client = new BootstrapClient(user);
  }

  async connect(): Promise<AuthorizationBootstrapClient> {
    return this.client;
  }
}

test("promotes a verified user once and records the bootstrap audit event", async () => {
  const database = new BootstrapDatabase({ emailVerified: true, id: "user-1" });

  const firstRun = await bootstrapAdministrator(database, " Admin@Example.test ");
  const secondRun = await bootstrapAdministrator(database, "admin@example.test");

  assert.deepEqual(firstRun, {
    assigned: true,
    email: "admin@example.test",
    userId: "user-1",
  });
  assert.deepEqual(secondRun, {
    assigned: false,
    email: "admin@example.test",
    userId: "user-1",
  });
  assert.equal(
    database.client.queries.filter((entry) => entry.query.includes('"audit_event"')).length,
    1,
  );
  assert.equal(database.client.released, true);
});

test("rejects absent and unverified users without assigning a role", async () => {
  const absentDatabase = new BootstrapDatabase(undefined);
  const unverifiedDatabase = new BootstrapDatabase({ emailVerified: false, id: "user-2" });

  await assert.rejects(
    () => bootstrapAdministrator(absentDatabase, "missing@example.test"),
    /No user exists/,
  );
  await assert.rejects(
    () => bootstrapAdministrator(unverifiedDatabase, "pending@example.test"),
    /must verify their email/,
  );
  assert.equal(
    absentDatabase.client.queries.some((entry) => entry.query.includes('"user_role"')),
    false,
  );
  assert.equal(
    unverifiedDatabase.client.queries.some((entry) => entry.query.includes('"user_role"')),
    false,
  );
});

test("requires exactly one email argument for the operational command", () => {
  assert.equal(readBootstrapEmailArgument([" Admin@Example.test "]), "admin@example.test");
  assert.throws(() => readBootstrapEmailArgument([]), /Usage/);
  assert.throws(() => readBootstrapEmailArgument(["a@example.test", "b@example.test"]), /Usage/);
});
