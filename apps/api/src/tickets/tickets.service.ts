import { Inject, Injectable } from "@nestjs/common";

import {
  type CreateTicketInput,
  type CreateTicketRecordInput,
  type ListTicketsInput,
  type ListTicketsQuery,
  type Ticket,
  type TicketExternalPriority,
  ticketExternalPriorities,
  type TicketList,
  TicketValidationError,
  type UpdateTicketInput,
  type UpdateTicketRecordInput,
} from "./tickets.contracts.js";
import { TicketRepository } from "./tickets.repository.js";

const ticketListPageSize = 25;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TicketStore {
  createTicket(input: CreateTicketRecordInput): Promise<Ticket>;
  deleteTicket(ticketId: string): Promise<void>;
  getTicket(ticketId: string): Promise<Ticket>;
  listTickets(query: ListTicketsQuery): Promise<TicketList>;
  updateTicket(ticketId: string, input: UpdateTicketRecordInput): Promise<Ticket>;
}

@Injectable()
export class TicketService {
  constructor(@Inject(TicketRepository) private readonly ticketRepository: TicketStore) {}

  async createTicket(input: CreateTicketInput, actorUserId: string): Promise<Ticket> {
    const actor = normalizeActorUserId(actorUserId);

    return this.ticketRepository.createTicket({
      actorUserId: actor,
      clientId: normalizeClientId(input.clientId),
      description: normalizeDescription(input.description) ?? null,
      externalPriority: normalizeExternalPriority(input.externalPriority ?? "medium"),
      externalReference: normalizeExternalReference(input.externalReference),
      externalUrl: normalizeExternalUrl(input.externalUrl) ?? null,
      title: normalizeTitle(input.title),
    });
  }

  async deleteTicket(ticketId: string): Promise<void> {
    await this.ticketRepository.deleteTicket(normalizeTicketId(ticketId));
  }

  async getTicket(ticketId: string): Promise<Ticket> {
    return this.ticketRepository.getTicket(normalizeTicketId(ticketId));
  }

  async listTickets(input: ListTicketsInput = {}): Promise<TicketList> {
    const page = input.page ?? 1;

    if (!Number.isSafeInteger(page) || page < 1) {
      throw new TicketValidationError("Ticket list page must be a positive integer.");
    }

    const priority = input.priority ?? "all";

    return this.ticketRepository.listTickets({
      clientId: input.clientId === undefined ? null : normalizeClientId(input.clientId),
      page,
      pageSize: ticketListPageSize,
      priority: priority === "all" ? null : normalizeExternalPriority(priority),
      query: normalizeSearchQuery(input.query),
    });
  }

  async updateTicket(
    ticketId: string,
    input: UpdateTicketInput,
    actorUserId: string,
  ): Promise<Ticket> {
    const normalized = normalizeTicketUpdate(input);

    return this.ticketRepository.updateTicket(normalizeTicketId(ticketId), {
      ...normalized,
      actorUserId: normalizeActorUserId(actorUserId),
    });
  }
}

function normalizeActorUserId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TicketValidationError("A Ticket change must identify its authenticated actor.");
  }

  return value;
}

function normalizeClientId(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new TicketValidationError("Ticket Client id must be a valid UUID.");
  }

  return value;
}

function normalizeDescription(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string" || value.length > 2000) {
    throw new TicketValidationError("Ticket description must contain at most 2000 characters.");
  }

  return value;
}

function normalizeExternalPriority(value: unknown): TicketExternalPriority {
  if (!(ticketExternalPriorities as readonly string[]).includes(value as string)) {
    throw new TicketValidationError("Ticket priority must be critical, high, medium, or low.");
  }

  return value as TicketExternalPriority;
}

function normalizeExternalReference(value: unknown): string {
  return normalizeTrimmedString(value, "Ticket external reference", 200);
}

function normalizeExternalUrl(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string" || value.length > 2048) {
    throw new TicketValidationError("Ticket external URL must contain at most 2048 characters.");
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new TicketValidationError("Ticket external URL must be an absolute HTTP or HTTPS URL.");
  }

  return value;
}

function normalizeSearchQuery(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new TicketValidationError("Ticket search query must be a string.");
  }

  return value.trim() || null;
}

function normalizeTicketId(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new TicketValidationError("Ticket id must be a valid UUID.");
  }

  return value;
}

function normalizeTicketUpdate(value: UpdateTicketInput): UpdateTicketInput {
  if (typeof value !== "object" || value === null) {
    throw new TicketValidationError("Ticket update must be an object.");
  }

  if (!Number.isSafeInteger(value.version) || value.version < 1) {
    throw new TicketValidationError("Ticket version must be a positive integer.");
  }

  const update: UpdateTicketInput = { version: value.version };

  if (value.externalReference !== undefined) {
    update.externalReference = normalizeExternalReference(value.externalReference);
  }

  if (value.externalUrl !== undefined) {
    update.externalUrl = normalizeExternalUrl(value.externalUrl);
  }

  if (value.title !== undefined) {
    update.title = normalizeTitle(value.title);
  }

  if (value.description !== undefined) {
    update.description = normalizeDescription(value.description);
  }

  if (value.externalPriority !== undefined) {
    update.externalPriority = normalizeExternalPriority(value.externalPriority);
  }

  if (Object.keys(update).length === 1) {
    throw new TicketValidationError("A Ticket update must change at least one field.");
  }

  return update;
}

function normalizeTitle(value: unknown): string {
  return normalizeTrimmedString(value, "Ticket title", 200);
}

function normalizeTrimmedString(value: unknown, field: string, maximumLength: number): string {
  if (typeof value !== "string") {
    throw new TicketValidationError(`${field} must be a string.`);
  }

  const normalized = value.trim();

  if (normalized.length < 1 || normalized.length > maximumLength) {
    throw new TicketValidationError(
      `${field} must contain between 1 and ${maximumLength} characters.`,
    );
  }

  return normalized;
}
