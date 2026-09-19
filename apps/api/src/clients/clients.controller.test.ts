import assert from "node:assert/strict";
import test from "node:test";

import { ConflictException } from "@nestjs/common";

import {
  type Client,
  type ClientCodeSettings,
  type ClientList,
  ClientRelatedRecordsError,
  ClientVersionConflictError,
  type ListClientsInput,
  type UpdateClientCodeSettingsInput,
} from "./clients.contracts.js";
import { ClientsController, type ClientsControllerStore } from "./clients.controller.js";

const timestamp = new Date("2026-09-19T00:00:00.000Z");
const requestContext = { authorization: { permissions: [], roles: [] }, userId: "user-1" };

function createClient(): Client {
  return {
    code: "CLI-001",
    createdAt: timestamp,
    createdByUserId: "user-1",
    id: "f6323093-e2fb-4875-a787-d1542064d138",
    isActive: true,
    name: "Cliente Uno",
    updatedAt: timestamp,
    updatedByUserId: "user-1",
    version: 1,
  };
}

function createSettings(): ClientCodeSettings {
  return {
    codeLength: 6,
    createdAt: timestamp,
    createdByUserId: null,
    nextSequence: 2n,
    prefix: "CLI",
    updatedAt: timestamp,
    updatedByUserId: "user-1",
    version: 2,
  };
}

function createStore(overrides: Partial<ClientsControllerStore> = {}): ClientsControllerStore {
  return {
    async createClient(): Promise<Client> {
      return createClient();
    },
    async deleteClient(): Promise<void> {},
    async getClient(): Promise<Client> {
      return createClient();
    },
    async getCodeSettings(): Promise<ClientCodeSettings> {
      return createSettings();
    },
    async listClients(): Promise<ClientList> {
      return { clients: [createClient()], page: 1, pageSize: 25, total: 1 };
    },
    async updateClient(): Promise<Client> {
      return createClient();
    },
    async updateCodeSettings(): Promise<ClientCodeSettings> {
      return createSettings();
    },
    ...overrides,
  };
}

test("lists Clients with the requested pagination, search, and status", async () => {
  let receivedInput: ListClientsInput | undefined;
  const controller = new ClientsController(
    createStore({
      async listClients(input) {
        receivedInput = input;
        return { clients: [createClient()], page: 2, pageSize: 25, total: 26 };
      },
    }),
  );

  const response = await controller.listClients("2", "CLI", "inactive");

  assert.deepEqual(receivedInput, { page: 2, query: "CLI", status: "inactive" });
  assert.deepEqual(response, {
    clients: [
      {
        code: "CLI-001",
        id: "f6323093-e2fb-4875-a787-d1542064d138",
        isActive: true,
        name: "Cliente Uno",
        version: 1,
      },
    ],
    page: 2,
    pageSize: 25,
    total: 26,
  });
});

test("updates code settings and serializes its bigint consecutive as a JSON string", async () => {
  let receivedInput: UpdateClientCodeSettingsInput | undefined;
  let receivedActorUserId: string | undefined;
  const controller = new ClientsController(
    createStore({
      async updateCodeSettings(input, actorUserId) {
        receivedInput = input;
        receivedActorUserId = actorUserId;
        return createSettings();
      },
    }),
  );

  const response = await controller.updateCodeSettings(
    { codeLength: 7, nextSequence: "10", prefix: "CLI", version: 1 },
    requestContext,
  );

  assert.deepEqual(receivedInput, {
    codeLength: 7,
    nextSequence: 10n,
    prefix: "CLI",
    version: 1,
  });
  assert.equal(receivedActorUserId, "user-1");
  assert.deepEqual(response, {
    settings: { codeLength: 6, nextSequence: "2", prefix: "CLI", version: 2 },
  });
});

test("maps a stale Client update to HTTP 409", async () => {
  const controller = new ClientsController(
    createStore({
      async updateClient() {
        throw new ClientVersionConflictError("Reload the Client.");
      },
    }),
  );

  await assert.rejects(
    () =>
      controller.updateClient(
        "f6323093-e2fb-4875-a787-d1542064d138",
        { isActive: false, version: 1 },
        requestContext,
      ),
    (error: unknown) => error instanceof ConflictException && error.getStatus() === 409,
  );
});

test("maps deletion blocked by Client relations to HTTP 409", async () => {
  const controller = new ClientsController(
    createStore({
      async deleteClient() {
        throw new ClientRelatedRecordsError("Disable the Client instead.");
      },
    }),
  );

  await assert.rejects(
    () => controller.deleteClient("f6323093-e2fb-4875-a787-d1542064d138"),
    (error: unknown) => error instanceof ConflictException && error.getStatus() === 409,
  );
});
