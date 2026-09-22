import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";

import {
  type CreateTicketInput,
  type ListTicketsInput,
  type Ticket,
  TicketNotFoundError,
  TicketRelatedRecordsError,
  TicketVersionConflictError,
} from "./tickets.contracts.js";
import { TicketsController, type TicketsControllerStore } from "./tickets.controller.js";
import { requiredPermissionsMetadataKey } from "../authorization/require-permissions.decorator.js";

const timestamp = new Date("2026-09-22T00:00:00.000Z");
const clientId = "f6323093-e2fb-4875-a787-d1542064d138";
const ticketId = "5d676d8c-9939-4a25-bdda-1a4df8b17873";
const requestContext = { authorization: { permissions: [], roles: [] }, userId: "user-1" };

function createTicket(): Ticket {
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
  };
}

function createStore(overrides: Partial<TicketsControllerStore> = {}): TicketsControllerStore {
  return {
    async createTicket(): Promise<Ticket> {
      return createTicket();
    },
    async deleteTicket(): Promise<void> {},
    async getTicket(): Promise<Ticket> {
      return createTicket();
    },
    async listTickets(): Promise<{
      page: number;
      pageSize: number;
      tickets: Ticket[];
      total: number;
    }> {
      return { page: 1, pageSize: 25, tickets: [createTicket()], total: 1 };
    },
    async updateTicket(): Promise<Ticket> {
      return createTicket();
    },
    ...overrides,
  };
}

test("declares the Ticket permission boundary for every route", () => {
  for (const [route, permissions] of [
    [TicketsController.prototype.listTickets, ["tickets.read"]],
    [TicketsController.prototype.createTicket, ["tickets.manage"]],
    [TicketsController.prototype.getTicket, ["tickets.read"]],
    [TicketsController.prototype.updateTicket, ["tickets.manage"]],
    [TicketsController.prototype.deleteTicket, ["tickets.manage"]],
  ]) {
    assert.deepEqual(Reflect.getMetadata(requiredPermissionsMetadataKey, route), permissions);
  }
});

test("lists Tickets with pagination, search, Client, and priority", async () => {
  let receivedInput: ListTicketsInput | undefined;
  const controller = new TicketsController(
    createStore({
      async listTickets(input) {
        receivedInput = input;
        return { page: 2, pageSize: 25, tickets: [createTicket()], total: 26 };
      },
    }),
  );

  const response = await controller.listTickets("2", "EXT", clientId, "high");

  assert.deepEqual(receivedInput, { clientId, page: 2, priority: "high", query: "EXT" });
  assert.equal(response.total, 26);
  assert.equal(response.tickets[0]?.externalReference, "EXT-001");
});

test("defaults a created Ticket priority and maps controlled errors", async () => {
  let receivedInput: CreateTicketInput | undefined;
  const createController = new TicketsController(
    createStore({
      async createTicket(input) {
        receivedInput = input;
        return createTicket();
      },
    }),
  );
  const staleController = new TicketsController(
    createStore({
      async updateTicket(): Promise<Ticket> {
        throw new TicketVersionConflictError("Reload the Ticket.");
      },
    }),
  );
  const missingController = new TicketsController(
    createStore({
      async getTicket(): Promise<Ticket> {
        throw new TicketNotFoundError("Ticket not found.");
      },
    }),
  );
  const relatedController = new TicketsController(
    createStore({
      async deleteTicket(): Promise<void> {
        throw new TicketRelatedRecordsError("Remove Activities first.");
      },
    }),
  );

  await createController.createTicket(
    { clientId, externalReference: "EXT-001", title: "Ticket" },
    requestContext,
  );
  assert.equal(receivedInput?.externalPriority, undefined);
  await assert.rejects(
    () => staleController.updateTicket(ticketId, { title: "Cambio", version: 1 }, requestContext),
    (error: unknown) => error instanceof ConflictException && error.getStatus() === 409,
  );
  await assert.rejects(
    () => missingController.getTicket(ticketId),
    (error: unknown) => error instanceof NotFoundException && error.getStatus() === 404,
  );
  await assert.rejects(
    () => relatedController.deleteTicket(ticketId),
    (error: unknown) => error instanceof ConflictException && error.getStatus() === 409,
  );
});

test("rejects invalid Ticket priority at the HTTP boundary", async () => {
  const controller = new TicketsController(createStore());

  await assert.rejects(
    () => controller.listTickets(undefined, undefined, undefined, "urgent"),
    (error: unknown) => error instanceof BadRequestException && error.getStatus() === 400,
  );
});

test("returns 400 for a malformed Client filter", async () => {
  const { TicketService } = await import("./tickets.service.js");
  let queried = false;
  const service = new TicketService({
    async createTicket() {
      throw new Error("Unexpected create");
    },
    async deleteTicket() {
      throw new Error("Unexpected delete");
    },
    async getTicket() {
      throw new Error("Unexpected detail");
    },
    async listTickets() {
      queried = true;
      throw new Error("Unexpected list");
    },
    async updateTicket() {
      throw new Error("Unexpected update");
    },
  });
  const controller = new TicketsController(service);

  await assert.rejects(
    () => controller.listTickets(undefined, undefined, "not-a-uuid", undefined),
    (error: unknown) => error instanceof BadRequestException && error.getStatus() === 400,
  );
  assert.equal(queried, false);
});
