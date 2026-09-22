import assert from "node:assert/strict";
import test from "node:test";

import {
  RequirementClientInactiveError,
  RequirementCodeExhaustedError,
  RequirementCodeSettingsVersionConflictError,
  RequirementRelatedRecordsError,
  RequirementVersionConflictError,
} from "./requirements.contracts.js";
import { RequirementRepository, type RequirementsDatabase } from "./requirements.repository.js";

const timestamp = new Date("2026-09-19T00:00:00.000Z");
const clientId = "f6323093-e2fb-4875-a787-d1542064d138";
const requirementId = "5d676d8c-9939-4a25-bdda-1a4df8b17873";

class ConcurrentRequirementsDatabase implements RequirementsDatabase {
  readonly requirements: Array<{ code: string; id: string }> = [];
  private settingsLock = Promise.resolve();

  constructor(
    readonly settings: {
      codeLength: number;
      nextSequence: bigint;
      prefix: string;
      version: number;
    } = {
      codeLength: 6,
      nextSequence: 1n,
      prefix: "REQ",
      version: 1,
    },
    readonly clientIsActive = true,
  ) {}

  async connect(): Promise<ConcurrentRequirementsTransaction> {
    return new ConcurrentRequirementsTransaction(this);
  }

  async query(): Promise<{ rowCount: number; rows: Record<string, unknown>[] }> {
    throw new Error("The repository should use a transaction when creating Requirements.");
  }

  async lockSettings(transaction: ConcurrentRequirementsTransaction): Promise<void> {
    const previousLock = this.settingsLock;
    let unlockSettings: (() => void) | undefined;
    this.settingsLock = new Promise<void>((resolve) => {
      unlockSettings = resolve;
    });
    await previousLock;
    transaction.setSettingsUnlock(unlockSettings);
  }
}

class ConcurrentRequirementsTransaction {
  private unlockSettings: (() => void) | undefined;

  constructor(private readonly database: ConcurrentRequirementsDatabase) {}

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
      return { rowCount: 1, rows: [settingsRow(this.database.settings)] };
    }

    if (query.includes('insert into "business"."requirement"')) {
      const [code] = values as [string];

      if (this.database.requirements.some((requirement) => requirement.code === code)) {
        throw new Error("duplicate Requirement code");
      }

      const id = `requirement-${this.database.requirements.length + 1}`;
      this.database.requirements.push({ code, id });
      return { rowCount: 1, rows: [requirementRow({ code, id })] };
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
      return { rowCount: 1, rows: [settingsRow(this.database.settings)] };
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

function requirementRow(
  overrides: Partial<{
    approved_by_user_id: string | null;
    approved_by_user_name: string | null;
    approved_on: Date | string | null;
    code: string;
    committed_on: Date | string | null;
    id: string;
    paused_from_status: string | null;
    quoted_on: Date | string | null;
    requested_on: Date | string;
    status: string;
    version: number;
  }> = {},
): Record<string, unknown> {
  return {
    approved_by_user_id: null,
    approved_by_user_name: null,
    approved_on: null,
    client_code: "CLI-001",
    client_id: clientId,
    client_name: "Cliente Uno",
    code: "REQ-001",
    committed_on: null,
    created_at: timestamp,
    created_by_user_id: "user-1",
    description: null,
    id: requirementId,
    name: "Requerimiento Uno",
    paused_from_status: null,
    quoted_on: null,
    requested_on: "2026-10-01",
    status: "new",
    updated_at: timestamp,
    updated_by_user_id: "user-1",
    version: 1,
    ...overrides,
  };
}

test("reserves a distinct Requirement code for simultaneous creations", async () => {
  const database = new ConcurrentRequirementsDatabase();
  const repository = new RequirementRepository(database);

  const requirements = await Promise.all([
    repository.createRequirement({
      actorUserId: "user-1",
      clientId,
      committedOn: null,
      description: null,
      name: "Requerimiento Uno",
      requestedOn: "2026-10-01",
      status: "new",
    }),
    repository.createRequirement({
      actorUserId: "user-2",
      clientId,
      committedOn: null,
      description: null,
      name: "Requerimiento Dos",
      requestedOn: "2026-10-02",
      status: "new",
    }),
  ]);

  assert.deepEqual(requirements.map((requirement) => requirement.code).sort(), [
    "REQ-001",
    "REQ-002",
  ]);
  assert.equal(new Set(database.requirements.map((requirement) => requirement.code)).size, 2);
  assert.equal(database.settings.nextSequence, 3n);
});

test("rejects Requirement creation for an inactive Client", async () => {
  const database = new ConcurrentRequirementsDatabase(undefined, false);
  const repository = new RequirementRepository(database);

  await assert.rejects(
    () =>
      repository.createRequirement({
        actorUserId: "user-1",
        clientId,
        committedOn: null,
        description: null,
        name: "Requerimiento Uno",
        requestedOn: "2026-10-01",
        status: "new",
      }),
    RequirementClientInactiveError,
  );

  assert.deepEqual(database.requirements, []);
  assert.equal(database.settings.nextSequence, 1n);
});

test("rejects code exhaustion before inserting a Requirement", async () => {
  const database = new ConcurrentRequirementsDatabase({
    codeLength: 6,
    nextSequence: 1000n,
    prefix: "REQ",
    version: 1,
  });
  const repository = new RequirementRepository(database);

  await assert.rejects(
    () =>
      repository.createRequirement({
        actorUserId: "user-1",
        clientId,
        committedOn: null,
        description: null,
        name: "Requerimiento Uno",
        requestedOn: "2026-10-01",
        status: "new",
      }),
    RequirementCodeExhaustedError,
  );

  assert.deepEqual(database.requirements, []);
});

test("reads Requirement settings from the requirement row of the shared code settings table", async () => {
  const queries: string[] = [];
  const database: RequirementsDatabase = {
    async connect() {
      throw new Error("Not used by this test.");
    },
    async query(query) {
      queries.push(query);
      return {
        rowCount: 1,
        rows: [settingsRow({ codeLength: 6, nextSequence: 1n, prefix: "REQ", version: 1 })],
      };
    },
  };
  const repository = new RequirementRepository(database);

  const settings = await repository.getCodeSettings();

  assert.equal(settings.prefix, "REQ");
  assert.match(queries[0] ?? "", /where "entity_type" = 'requirement'/i);
});

test("returns the approver name with a Requirement detail", async () => {
  const queries: string[] = [];
  const database: RequirementsDatabase = {
    async connect() {
      throw new Error("Not used by this test.");
    },
    async query(query) {
      queries.push(query);
      return {
        rowCount: 1,
        rows: [
          requirementRow({
            approved_by_user_id: "user-1",
            approved_by_user_name: "María Pérez",
            approved_on: "2026-10-03",
            status: "approved",
          }),
        ],
      };
    },
  };
  const repository = new RequirementRepository(database);

  const requirement = await repository.getRequirement(requirementId);

  assert.equal(requirement.approvedByUserName, "María Pérez");
  assert.match(queries[0] ?? "", /left join "auth"\."user" as "approver"/i);
});

test("returns the preserved workflow state for a paused Requirement", async () => {
  const database: RequirementsDatabase = {
    async connect() {
      throw new Error("Not used by this test.");
    },
    async query() {
      return {
        rowCount: 1,
        rows: [
          requirementRow({
            approved_by_user_id: "user-1",
            approved_by_user_name: "María Pérez",
            approved_on: "2026-10-03",
            paused_from_status: "in_execution",
            quoted_on: "2026-10-02",
            status: "paused",
          }),
        ],
      };
    },
  };
  const repository = new RequirementRepository(database);

  const requirement = await repository.getRequirement(requirementId);

  assert.equal(requirement.status, "paused");
  assert.equal(requirement.pausedFromStatus, "in_execution");
});

test("rejects a stale Requirement update without overwriting the current version", async () => {
  const queries: Array<{ query: string; values?: unknown[] }> = [];
  const database: RequirementsDatabase = {
    async connect() {
      throw new Error("Not used by this test.");
    },
    async query(query, values) {
      queries.push({ query, values });

      if (query.includes('update "business"."requirement"')) {
        return { rowCount: 0, rows: [] };
      }

      if (query.includes('from "business"."requirement" as "requirement"')) {
        return { rowCount: 1, rows: [requirementRow({ version: 2 })] };
      }

      throw new Error(`Unexpected query: ${query}`);
    },
  };
  const repository = new RequirementRepository(database);

  await assert.rejects(
    () =>
      repository.updateRequirement(requirementId, {
        actorUserId: "user-1",
        approvedByUserId: "user-1",
        approvedOn: "2026-10-03",
        pausedFromStatus: null,
        status: "approved",
        version: 1,
      }),
    RequirementVersionConflictError,
  );
  assert.deepEqual(queries[0]?.values, [
    requirementId,
    null,
    false,
    null,
    null,
    false,
    null,
    false,
    null,
    true,
    "2026-10-03",
    "user-1",
    "approved",
    null,
    "user-1",
    1,
  ]);
});

test("rejects a stale Requirement code settings update", async () => {
  const database = new ConcurrentRequirementsDatabase({
    codeLength: 6,
    nextSequence: 2n,
    prefix: "REQ",
    version: 4,
  });
  const repository = new RequirementRepository(database);

  await assert.rejects(
    () =>
      repository.updateCodeSettings({
        actorUserId: "user-1",
        codeLength: 7,
        nextSequence: 2n,
        prefix: "REQ",
        version: 3,
      }),
    RequirementCodeSettingsVersionConflictError,
  );
});

test("maps a relationship restriction to a controlled Requirement deletion error", async () => {
  const database: RequirementsDatabase = {
    async connect() {
      throw new Error("Not used by this test.");
    },
    async query(query) {
      if (query.includes('delete from "business"."requirement"')) {
        throw { code: "23503" };
      }

      throw new Error(`Unexpected query: ${query}`);
    },
  };
  const repository = new RequirementRepository(database);

  await assert.rejects(
    () => repository.deleteRequirement(requirementId),
    RequirementRelatedRecordsError,
  );
});
