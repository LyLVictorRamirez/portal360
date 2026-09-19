import assert from "node:assert/strict";
import test from "node:test";

import {
  ClientCodeExhaustedError,
  ClientRelatedRecordsError,
  ClientVersionConflictError,
  type Client,
} from "./clients.contracts.js";
import {
  ClientRepository,
  type ClientsDatabase,
} from "./clients.repository.js";

const timestamp = new Date("2026-09-18T00:00:00.000Z");

class ConcurrentClientsDatabase implements ClientsDatabase {
  readonly clients: Client[] = [];
  private settingsLock = Promise.resolve();

  constructor(
    readonly settings: {
      codeLength: number;
      nextSequence: bigint;
      prefix: string;
      version: number;
    } = { codeLength: 6, nextSequence: 1n, prefix: "CLI", version: 1 },
  ) {}

  async connect(): Promise<ConcurrentClientsTransaction> {
    return new ConcurrentClientsTransaction(this);
  }

  async query(): Promise<{ rowCount: number; rows: Record<string, unknown>[] }> {
    throw new Error("The repository should use a transaction when creating Clients.");
  }

  async lockSettings(transaction: ConcurrentClientsTransaction): Promise<void> {
    const previousLock = this.settingsLock;
    let unlockSettings: (() => void) | undefined;
    this.settingsLock = new Promise<void>((resolve) => {
      unlockSettings = resolve;
    });
    await previousLock;
    transaction.setSettingsUnlock(unlockSettings);
  }
}

class ConcurrentClientsTransaction {
  private unlockSettings: (() => void) | undefined;

  constructor(private readonly database: ConcurrentClientsDatabase) {}

  async query(
    query: string,
    values: unknown[] = [],
  ): Promise<{ rowCount: number; rows: Record<string, unknown>[] }> {
    if (query === "BEGIN") {
      return { rowCount: 0, rows: [] };
    }

    if (query.includes("for update")) {
      await this.database.lockSettings(this);

      return {
        rowCount: 1,
        rows: [
          {
            code_length: this.database.settings.codeLength,
            created_at: timestamp,
            created_by_user_id: null,
            next_sequence: this.database.settings.nextSequence.toString(),
            prefix: this.database.settings.prefix,
            updated_at: timestamp,
            updated_by_user_id: null,
            version: this.database.settings.version,
          },
        ],
      };
    }

    if (query.includes('insert into "business"."client"')) {
      const [code, name, createdByUserId, updatedByUserId] = values as string[];

      if (this.database.clients.some((client) => client.code === code)) {
        throw new Error("duplicate Client code");
      }

      const client: Client = {
        code,
        createdAt: timestamp,
        createdByUserId,
        id: `client-${this.database.clients.length + 1}`,
        isActive: true,
        name,
        updatedAt: timestamp,
        updatedByUserId,
        version: 1,
      };
      this.database.clients.push(client);

      return {
        rowCount: 1,
        rows: [
          {
            code: client.code,
            created_at: client.createdAt,
            created_by_user_id: client.createdByUserId,
            id: client.id,
            is_active: client.isActive,
            name: client.name,
            updated_at: client.updatedAt,
            updated_by_user_id: client.updatedByUserId,
            version: client.version,
          },
        ],
      };
    }

    if (query.includes('update "business"."client_code_settings"')) {
      this.database.settings.nextSequence = BigInt(values[0] as string);
      this.database.settings.version += 1;

      return { rowCount: 1, rows: [] };
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

test("reserves a distinct Client code for simultaneous creations", async () => {
  const database = new ConcurrentClientsDatabase();
  const repository = new ClientRepository(database);

  const clients = await Promise.all([
    repository.createClient({ actorUserId: "user-1", name: "Cliente Uno" }),
    repository.createClient({ actorUserId: "user-2", name: "Cliente Dos" }),
  ]);

  assert.deepEqual(
    clients.map((client) => client.code).sort(),
    ["CLI-001", "CLI-002"],
  );
  assert.equal(new Set(database.clients.map((client) => client.code)).size, 2);
  assert.equal(database.settings.nextSequence, 3n);
});

test("rolls back a Client creation when the configured code length is exhausted", async () => {
  const database = new ConcurrentClientsDatabase({
    codeLength: 6,
    nextSequence: 1000n,
    prefix: "CLI",
    version: 1,
  });
  const repository = new ClientRepository(database);

  await assert.rejects(
    () => repository.createClient({ actorUserId: "user-1", name: "Cliente Uno" }),
    ClientCodeExhaustedError,
  );

  assert.deepEqual(database.clients, []);
  assert.equal(database.settings.nextSequence, 1000n);
});

test("rejects a stale Client update without overwriting the current version", async () => {
  const queries: Array<{ query: string; values?: unknown[] }> = [];
  const database: ClientsDatabase = {
    async connect() {
      throw new Error("Not used by this test.");
    },
    async query(query, values) {
      queries.push({ query, values });

      if (query.includes('update "business"."client"')) {
        return { rowCount: 0, rows: [] };
      }

      if (query.includes('from "business"."client"')) {
        return {
          rowCount: 1,
          rows: [
            {
              code: "CLI-001",
              created_at: timestamp,
              created_by_user_id: "user-1",
              id: "f6323093-e2fb-4875-a787-d1542064d138",
              is_active: true,
              name: "Cliente Uno",
              updated_at: timestamp,
              updated_by_user_id: "user-2",
              version: 2,
            },
          ],
        };
      }

      throw new Error(`Unexpected query: ${query}`);
    },
  };
  const repository = new ClientRepository(database);

  await assert.rejects(
    () =>
      repository.updateClient("f6323093-e2fb-4875-a787-d1542064d138", {
        actorUserId: "user-1",
        isActive: false,
        version: 1,
      }),
    ClientVersionConflictError,
  );
  assert.deepEqual(queries[0]?.values, [
    "f6323093-e2fb-4875-a787-d1542064d138",
    null,
    false,
    "user-1",
    1,
  ]);
});

test("maps a relationship restriction to a controlled Client deletion error", async () => {
  const database: ClientsDatabase = {
    async connect() {
      throw new Error("Not used by this test.");
    },
    async query(query) {
      if (query.includes('delete from "business"."client"')) {
        throw { code: "23503" };
      }

      throw new Error(`Unexpected query: ${query}`);
    },
  };
  const repository = new ClientRepository(database);

  await assert.rejects(
    () => repository.deleteClient("f6323093-e2fb-4875-a787-d1542064d138"),
    ClientRelatedRecordsError,
  );
});
