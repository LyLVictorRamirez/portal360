import assert from "node:assert/strict";
import test from "node:test";

import {
  type CreateTicketRecordInput,
  type ListTicketsQuery,
  type Ticket,
  type TicketList,
  TicketValidationError,
  type UpdateTicketRecordInput,
} from "./tickets.contracts.js";
import { TicketService, type TicketStore } from "./tickets.service.js";

const timestamp = new Date("2026-09-22T00:00:00.000Z");
const clientId = "f6323093-e2fb-4875-a787-d1542064d138";
const ticketId = "5d676d8c-9939-4a25-bdda-1a4df8b17873";

function createTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    client: { code: "CLI-001", id: clientId, name: "Cliente Uno" },
    createdAt: timestamp,
    createdByUserId: "user-1",
    description: null,
    externalPriority: "medium",
    externalReference: "EXT-001",
    externalUrl: null,
    id: ticketId,
    title: "Ticket Uno",
    updatedAt: timestamp,
    updatedByUserId: "user-1",
    version: 1,
    ...overrides,
  };
}

function createStore(overrides: Partial<TicketStore> = {}): TicketStore {
  return {
    async createTicket(): Promise<Ticket> {
      return createTicket();
    },
    async deleteTicket(): Promise<void> {},
    async getTicket(): Promise<Ticket> {
      return createTicket();
    },
    async listTickets(query: ListTicketsQuery): Promise<TicketList> {
      return { page: query.page, pageSize: query.pageSize, tickets: [], total: 0 };
    },
    async updateTicket(): Promise<Ticket> {
      return createTicket();
    },
    ...overrides,
  };
}

test("creates Tickets with a medium default and normalized external fields", async () => {
  let receivedInput: CreateTicketRecordInput | undefined;
  const service = new TicketService(
    createStore({
      async createTicket(input) {
        receivedInput = input;
        return createTicket({ externalPriority: input.externalPriority });
      },
    }),
  );

  await service.createTicket(
    {
      clientId,
      description: "Contexto externo",
      externalReference: "  EXT-001  ",
      externalUrl: "https://tracker.example.com/EXT-001",
      title: "  Ticket Uno  ",
    },
    "user-1",
  );

  assert.deepEqual(receivedInput, {
    actorUserId: "user-1",
    clientId,
    description: "Contexto externo",
    externalPriority: "medium",
    externalReference: "EXT-001",
    externalUrl: "https://tracker.example.com/EXT-001",
    title: "Ticket Uno",
  });
});

test("rejects malformed Ticket URLs and invalid priorities before persistence", async () => {
  let attempts = 0;
  const service = new TicketService(
    createStore({
      async createTicket() {
        attempts += 1;
        return createTicket();
      },
    }),
  );

  await assert.rejects(
    () =>
      service.createTicket(
        { clientId, externalReference: "EXT-001", externalUrl: "ftp://example.com", title: "Ticket" },
        "user-1",
      ),
    TicketValidationError,
  );
  await assert.rejects(
    () =>
      service.createTicket(
        {
          clientId,
          externalPriority: "urgent" as never,
          externalReference: "EXT-001",
          title: "Ticket",
        },
        "user-1",
      ),
    TicketValidationError,
  );

  assert.equal(attempts, 0);
});

test("lists 25 Tickets per page with Client and priority filters", async () => {
  let receivedQuery: ListTicketsQuery | undefined;
  const service = new TicketService(
    createStore({
      async listTickets(query) {
        receivedQuery = query;
        return { page: query.page, pageSize: query.pageSize, tickets: [], total: 0 };
      },
    }),
  );

  await service.listTickets({ clientId, page: 2, priority: "high", query: "  EXT-001  " });

  assert.deepEqual(receivedQuery, {
    clientId,
    page: 2,
    pageSize: 25,
    priority: "high",
    query: "EXT-001",
  });
});

test("updates Ticket fields without allowing a Client change", async () => {
  let receivedInput: UpdateTicketRecordInput | undefined;
  const service = new TicketService(
    createStore({
      async updateTicket(_id, input) {
        receivedInput = input;
        return createTicket({ title: input.title ?? "Ticket Uno", version: 2 });
      },
    }),
  );

  await service.updateTicket(ticketId, { title: "  Cambio  ", version: 1 }, "user-2");

  assert.deepEqual(receivedInput, { actorUserId: "user-2", title: "Cambio", version: 1 });
});
