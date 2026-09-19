import assert from "node:assert/strict";
import test from "node:test";

import {
  type Client,
  type ClientCodeSettings,
  type ClientList,
  ClientValidationError,
  type CreateClientRecordInput,
  type ListClientsQuery,
} from "./clients.contracts.js";
import type { ClientStore } from "./clients.service.js";
import { ClientService } from "./clients.service.js";

const createdAt = new Date("2026-09-18T00:00:00.000Z");

function createClient(): Client {
  return {
    code: "CLI-001",
    createdAt,
    createdByUserId: "user-1",
    id: "f6323093-e2fb-4875-a787-d1542064d138",
    isActive: true,
    name: "Cliente Uno",
    updatedAt: createdAt,
    updatedByUserId: "user-1",
    version: 1,
  };
}

test("trims a Client name before reserving and creating its generated code", async () => {
  let receivedInput: CreateClientRecordInput | undefined;
  const store: ClientStore = {
    async createClient(input) {
      receivedInput = input;
      return createClient();
    },
    async getCodeSettings(): Promise<ClientCodeSettings> {
      throw new Error("Not used by this test.");
    },
    async listClients(): Promise<ClientList> {
      throw new Error("Not used by this test.");
    },
  };
  const service = new ClientService(store);

  const client = await service.createClient({ name: "  Cliente Uno  " }, "user-1");

  assert.equal(client.code, "CLI-001");
  assert.deepEqual(receivedInput, { actorUserId: "user-1", name: "Cliente Uno" });
});

test("rejects an empty or oversized Client name", async () => {
  const store = {
    async createClient(): Promise<Client> {
      throw new Error("Not used by this test.");
    },
    async getCodeSettings(): Promise<ClientCodeSettings> {
      throw new Error("Not used by this test.");
    },
    async listClients(): Promise<ClientList> {
      throw new Error("Not used by this test.");
    },
  } satisfies ClientStore;
  const service = new ClientService(store);

  await assert.rejects(
    () => service.createClient({ name: "   " }, "user-1"),
    ClientValidationError,
  );
  await assert.rejects(
    () => service.createClient({ name: "x".repeat(201) }, "user-1"),
    ClientValidationError,
  );
});

test("lists 25 Clients per page with a trimmed search and status filter", async () => {
  let receivedQuery: ListClientsQuery | undefined;
  const store: ClientStore = {
    async createClient(): Promise<Client> {
      throw new Error("Not used by this test.");
    },
    async getCodeSettings(): Promise<ClientCodeSettings> {
      throw new Error("Not used by this test.");
    },
    async listClients(query) {
      receivedQuery = query;
      return { clients: [], page: query.page, pageSize: query.pageSize, total: 0 };
    },
  };
  const service = new ClientService(store);

  const result = await service.listClients({ page: 2, query: "  cli-001  ", status: "inactive" });

  assert.deepEqual(receivedQuery, {
    isActive: false,
    page: 2,
    pageSize: 25,
    query: "cli-001",
  });
  assert.deepEqual(result, { clients: [], page: 2, pageSize: 25, total: 0 });
});
