import assert from "node:assert/strict";
import test from "node:test";

import {
  ProjectClientInactiveError,
  ProjectCodeSettingsVersionConflictError,
  ProjectRelatedRecordsError,
  ProjectVersionConflictError,
} from "./projects.contracts.js";
import { ProjectRepository, type ProjectsDatabase } from "./projects.repository.js";

const timestamp = new Date("2026-09-19T00:00:00.000Z");

class ConcurrentProjectsDatabase implements ProjectsDatabase {
  readonly projects: Array<{ code: string; id: string }> = [];
  private settingsLock = Promise.resolve();

  constructor(
    readonly settings: {
      codeLength: number;
      nextSequence: bigint;
      prefix: string;
      version: number;
    } = { codeLength: 6, nextSequence: 1n, prefix: "PRY", version: 1 },
    readonly clientIsActive = true,
  ) {}

  async connect(): Promise<ConcurrentProjectsTransaction> {
    return new ConcurrentProjectsTransaction(this);
  }

  async query(): Promise<{ rowCount: number; rows: Record<string, unknown>[] }> {
    throw new Error("The repository should use a transaction when creating Projects.");
  }

  async lockSettings(transaction: ConcurrentProjectsTransaction): Promise<void> {
    const previousLock = this.settingsLock;
    let unlockSettings: (() => void) | undefined;
    this.settingsLock = new Promise<void>((resolve) => {
      unlockSettings = resolve;
    });
    await previousLock;
    transaction.setSettingsUnlock(unlockSettings);
  }
}

class ConcurrentProjectsTransaction {
  private unlockSettings: (() => void) | undefined;

  constructor(private readonly database: ConcurrentProjectsDatabase) {}

  async query(
    query: string,
    values: unknown[] = [],
  ): Promise<{ rowCount: number; rows: Record<string, unknown>[] }> {
    if (query === "BEGIN") {
      return { rowCount: 0, rows: [] };
    }

    if (query.includes('from "business"."client"') && query.includes("for update")) {
      return { rowCount: 1, rows: [{ is_active: this.database.clientIsActive }] };
    }

    if (query.includes('from "business"."entity_code_settings"') && query.includes("for update")) {
      await this.database.lockSettings(this);

      return {
        rowCount: 1,
        rows: [settingsRow(this.database.settings)],
      };
    }

    if (query.includes('insert into "business"."project"')) {
      const [code] = values as [string];

      if (this.database.projects.some((project) => project.code === code)) {
        throw new Error("duplicate Project code");
      }

      const id = `project-${this.database.projects.length + 1}`;
      this.database.projects.push({ code, id });

      return {
        rowCount: 1,
        rows: [projectRow({ code, id })],
      };
    }

    if (query.includes('set "next_sequence" = $1')) {
      this.database.settings.nextSequence = BigInt(values[0] as string);
      this.database.settings.version += 1;

      return { rowCount: 1, rows: [] };
    }

    if (query.includes('set "prefix" = $1')) {
      const [prefix, codeLength, nextSequence] = values as [string, number, string];
      this.database.settings.prefix = prefix;
      this.database.settings.codeLength = codeLength;
      this.database.settings.nextSequence = BigInt(nextSequence);
      this.database.settings.version += 1;

      return {
        rowCount: 1,
        rows: [settingsRow(this.database.settings)],
      };
    }

    if (query === "COMMIT" || query === "ROLLBACK") {
      this.releaseSettingsLock();
      return { rowCount: 0, rows: [] };
    }

    throw new Error(`Unexpected query: ${query}`);
  }

  release(): void {}

  setSettingsUnlock(unlockSettings: (() => void) | undefined): void {
    this.unlockSettings = unlockSettings;
  }

  private releaseSettingsLock(): void {
    this.unlockSettings?.();
    this.unlockSettings = undefined;
  }
}

function settingsRow(settings: {
  codeLength: number;
  nextSequence: bigint;
  prefix: string;
  version: number;
}): Record<string, unknown> {
  return {
    code_length: settings.codeLength,
    created_at: timestamp,
    created_by_user_id: null,
    next_sequence: settings.nextSequence.toString(),
    prefix: settings.prefix,
    updated_at: timestamp,
    updated_by_user_id: "user-1",
    version: settings.version,
  };
}

function projectRow(
  overrides: Partial<{
    code: string;
    committed_end_date: Date | string;
    id: string;
    start_date: Date | string;
    status: string;
    version: number;
  }> = {},
): Record<string, unknown> {
  return {
    client_code: "CLI-001",
    client_id: "f6323093-e2fb-4875-a787-d1542064d138",
    client_name: "Cliente Uno",
    code: "PRY-001",
    committed_end_date: "2026-10-31",
    created_at: timestamp,
    created_by_user_id: "user-1",
    description: null,
    id: "5d676d8c-9939-4a25-bdda-1a4df8b17873",
    name: "Proyecto Uno",
    start_date: "2026-10-01",
    status: "new",
    updated_at: timestamp,
    updated_by_user_id: "user-1",
    version: 1,
    ...overrides,
  };
}

test("reserves a distinct Project code for simultaneous creations", async () => {
  const database = new ConcurrentProjectsDatabase();
  const repository = new ProjectRepository(database);

  const projects = await Promise.all([
    repository.createProject({
      actorUserId: "user-1",
      clientId: "f6323093-e2fb-4875-a787-d1542064d138",
      committedEndDate: "2026-10-31",
      name: "Proyecto Uno",
      startDate: "2026-10-01",
      status: "new",
    }),
    repository.createProject({
      actorUserId: "user-2",
      clientId: "f6323093-e2fb-4875-a787-d1542064d138",
      committedEndDate: "2026-11-30",
      name: "Proyecto Dos",
      startDate: "2026-11-01",
      status: "in_execution",
    }),
  ]);

  assert.deepEqual(projects.map((project) => project.code).sort(), ["PRY-001", "PRY-002"]);
  assert.equal(new Set(database.projects.map((project) => project.code)).size, 2);
  assert.equal(database.settings.nextSequence, 3n);
});

test("rejects Project creation for an inactive Client", async () => {
  const database = new ConcurrentProjectsDatabase(undefined, false);
  const repository = new ProjectRepository(database);

  await assert.rejects(
    () =>
      repository.createProject({
        actorUserId: "user-1",
        clientId: "f6323093-e2fb-4875-a787-d1542064d138",
        committedEndDate: "2026-10-31",
        name: "Proyecto Uno",
        startDate: "2026-10-01",
        status: "new",
      }),
    ProjectClientInactiveError,
  );

  assert.deepEqual(database.projects, []);
  assert.equal(database.settings.nextSequence, 1n);
});

test("reads Project settings from the project row of the shared code settings table", async () => {
  const queries: string[] = [];
  const database: ProjectsDatabase = {
    async connect() {
      throw new Error("Not used by this test.");
    },
    async query(query) {
      queries.push(query);
      return {
        rowCount: 1,
        rows: [settingsRow({ codeLength: 6, nextSequence: 1n, prefix: "PRY", version: 1 })],
      };
    },
  };
  const repository = new ProjectRepository(database);

  const settings = await repository.getCodeSettings();

  assert.equal(settings.prefix, "PRY");
  assert.match(queries[0] ?? "", /from "business"\."entity_code_settings"/i);
  assert.match(queries[0] ?? "", /where "entity_type" = 'project'/i);
});

test("normalizes calendar dates returned as Date objects by the business database", async () => {
  const database: ProjectsDatabase = {
    async connect() {
      throw new Error("Not used by this test.");
    },
    async query(query) {
      if (query.includes('from "business"."project" as "project"')) {
        return {
          rowCount: 1,
          rows: [
            projectRow({
              committed_end_date: new Date("2026-10-31T00:00:00.000Z"),
              start_date: new Date("2026-10-01T00:00:00.000Z"),
            }),
          ],
        };
      }

      throw new Error(`Unexpected query: ${query}`);
    },
  };
  const repository = new ProjectRepository(database);

  const project = await repository.getProject("5d676d8c-9939-4a25-bdda-1a4df8b17873");

  assert.equal(project.startDate, "2026-10-01");
  assert.equal(project.committedEndDate, "2026-10-31");
});

test("updates Project code settings after locking their current version", async () => {
  const database = new ConcurrentProjectsDatabase();
  const repository = new ProjectRepository(database);

  const settings = await repository.updateCodeSettings({
    actorUserId: "user-1",
    codeLength: 7,
    nextSequence: 10n,
    prefix: "PRY",
    version: 1,
  });

  assert.equal(settings.codeLength, 7);
  assert.equal(settings.nextSequence, 10n);
  assert.equal(settings.version, 2);
});

test("rejects a stale Project code settings update", async () => {
  const database = new ConcurrentProjectsDatabase({
    codeLength: 6,
    nextSequence: 2n,
    prefix: "PRY",
    version: 4,
  });
  const repository = new ProjectRepository(database);

  await assert.rejects(
    () =>
      repository.updateCodeSettings({
        actorUserId: "user-1",
        codeLength: 7,
        nextSequence: 2n,
        prefix: "PRY",
        version: 3,
      }),
    ProjectCodeSettingsVersionConflictError,
  );
});

test("rejects a stale Project update without overwriting the current version", async () => {
  const queries: Array<{ query: string; values?: unknown[] }> = [];
  const database: ProjectsDatabase = {
    async connect() {
      throw new Error("Not used by this test.");
    },
    async query(query, values) {
      queries.push({ query, values });

      if (query.includes('update "business"."project"')) {
        return { rowCount: 0, rows: [] };
      }

      if (query.includes('from "business"."project" as "project"')) {
        return { rowCount: 1, rows: [projectRow({ version: 2 })] };
      }

      throw new Error(`Unexpected query: ${query}`);
    },
  };
  const repository = new ProjectRepository(database);

  await assert.rejects(
    () =>
      repository.updateProject("5d676d8c-9939-4a25-bdda-1a4df8b17873", {
        actorUserId: "user-1",
        status: "in_execution",
        version: 1,
      }),
    ProjectVersionConflictError,
  );
  assert.deepEqual(queries[0]?.values, [
    "5d676d8c-9939-4a25-bdda-1a4df8b17873",
    null,
    false,
    null,
    null,
    null,
    "in_execution",
    "user-1",
    1,
  ]);
});

test("maps a relationship restriction to a controlled Project deletion error", async () => {
  const database: ProjectsDatabase = {
    async connect() {
      throw new Error("Not used by this test.");
    },
    async query(query) {
      if (query.includes('delete from "business"."project"')) {
        throw { code: "23503" };
      }

      throw new Error(`Unexpected query: ${query}`);
    },
  };
  const repository = new ProjectRepository(database);

  await assert.rejects(
    () => repository.deleteProject("5d676d8c-9939-4a25-bdda-1a4df8b17873"),
    ProjectRelatedRecordsError,
  );
});
