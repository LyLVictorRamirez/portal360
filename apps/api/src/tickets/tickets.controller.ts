import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";

import { AuthorizationContext } from "../authorization/authorization-context.decorator.js";
import { AuthorizationGuard } from "../authorization/authorization.guard.js";
import { RequirePermissions } from "../authorization/require-permissions.decorator.js";
import type { AuthorizationRequestContext } from "../authorization/authorization.types.js";
import {
  type CreateTicketInput,
  type ListTicketsInput,
  type Ticket,
  type TicketExternalPriority,
  type TicketExternalPriorityFilter,
  TicketClientInactiveError,
  TicketClientNotFoundError,
  TicketNotFoundError,
  TicketRelatedRecordsError,
  TicketValidationError,
  TicketVersionConflictError,
  type UpdateTicketInput,
} from "./tickets.contracts.js";
import { TicketService } from "./tickets.service.js";

interface TicketResponse {
  client: Ticket["client"];
  description: string | null;
  externalPriority: TicketExternalPriority;
  externalReference: string;
  externalUrl: string | null;
  id: string;
  title: string;
  version: number;
}

export interface TicketsControllerStore {
  createTicket(input: CreateTicketInput, actorUserId: string): Promise<Ticket>;
  deleteTicket(ticketId: string): Promise<void>;
  getTicket(ticketId: string): Promise<Ticket>;
  listTickets(input: ListTicketsInput): Promise<{
    page: number;
    pageSize: number;
    tickets: Ticket[];
    total: number;
  }>;
  updateTicket(ticketId: string, input: UpdateTicketInput, actorUserId: string): Promise<Ticket>;
}

@Controller("api/tickets")
@UseGuards(AuthorizationGuard)
export class TicketsController {
  constructor(@Inject(TicketService) private readonly ticketService: TicketsControllerStore) {}

  @Get()
  @RequirePermissions("tickets.read")
  async listTickets(
    @Query("page") page: string | undefined,
    @Query("query") query: string | undefined,
    @Query("clientId") clientId: string | undefined,
    @Query("priority") priority: string | undefined,
  ): Promise<{ page: number; pageSize: number; tickets: TicketResponse[]; total: number }> {
    try {
      const tickets = await this.ticketService.listTickets({
        clientId,
        page: readOptionalPage(page),
        priority: readOptionalPriority(priority),
        query,
      });

      return {
        page: tickets.page,
        pageSize: tickets.pageSize,
        tickets: tickets.tickets.map(toTicketResponse),
        total: tickets.total,
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Post()
  @RequirePermissions("tickets.manage")
  async createTicket(
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ ticket: TicketResponse }> {
    try {
      return {
        ticket: toTicketResponse(
          await this.ticketService.createTicket(readCreateTicketInput(body), context.userId),
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Get(":ticketId")
  @RequirePermissions("tickets.read")
  async getTicket(@Param("ticketId") ticketId: string): Promise<{ ticket: TicketResponse }> {
    try {
      return { ticket: toTicketResponse(await this.ticketService.getTicket(ticketId)) };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Put(":ticketId")
  @RequirePermissions("tickets.manage")
  async updateTicket(
    @Param("ticketId") ticketId: string,
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ ticket: TicketResponse }> {
    try {
      return {
        ticket: toTicketResponse(
          await this.ticketService.updateTicket(
            ticketId,
            readUpdateTicketInput(body),
            context.userId,
          ),
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Delete(":ticketId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("tickets.manage")
  async deleteTicket(@Param("ticketId") ticketId: string): Promise<void> {
    try {
      await this.ticketService.deleteTicket(ticketId);
    } catch (error) {
      throw toHttpException(error);
    }
  }
}

function readCreateTicketInput(body: unknown): CreateTicketInput {
  const record = readRecord(body);

  for (const property of ["clientId", "externalReference", "title"] as const) {
    if (typeof record[property] !== "string") {
      throw new BadRequestException(`${property} is required.`);
    }
  }

  if (!isOptionalString(record.description) || !isOptionalString(record.externalUrl)) {
    throw new BadRequestException(
      "description and externalUrl must be strings or null when provided.",
    );
  }

  return {
    clientId: record.clientId as string,
    description: record.description as string | null | undefined,
    externalPriority:
      record.externalPriority === undefined
        ? undefined
        : readRequiredPriority(record.externalPriority),
    externalReference: record.externalReference as string,
    externalUrl: record.externalUrl as string | null | undefined,
    title: record.title as string,
  };
}

function readOptionalPage(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new BadRequestException("page must be a positive integer.");
  }

  return readPositiveInteger(Number(value), "page");
}

function readOptionalPriority(value: unknown): TicketExternalPriorityFilter | undefined {
  if (value === undefined || value === "all") {
    return value;
  }

  return readRequiredPriority(value);
}

function readPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }

  return value;
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("The request body must be an object.");
  }

  return value as Record<string, unknown>;
}

function readRequiredPriority(value: unknown): TicketExternalPriority {
  if (value !== "critical" && value !== "high" && value !== "medium" && value !== "low") {
    throw new BadRequestException("externalPriority must be critical, high, medium, or low.");
  }

  return value;
}

function readUpdateTicketInput(body: unknown): UpdateTicketInput {
  const record = readRecord(body);
  const input: UpdateTicketInput = { version: readPositiveInteger(record.version, "version") };

  for (const property of ["externalReference", "title"] as const) {
    if (record[property] !== undefined) {
      if (typeof record[property] !== "string") {
        throw new BadRequestException(`${property} must be a string when provided.`);
      }

      input[property] = record[property];
    }
  }

  for (const property of ["description", "externalUrl"] as const) {
    if (record[property] !== undefined) {
      if (!isOptionalString(record[property])) {
        throw new BadRequestException(`${property} must be a string or null when provided.`);
      }

      input[property] = record[property] as string | null;
    }
  }

  if (record.externalPriority !== undefined) {
    input.externalPriority = readRequiredPriority(record.externalPriority);
  }

  return input;
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function toHttpException(error: unknown): Error {
  if (error instanceof TicketNotFoundError || error instanceof TicketClientNotFoundError) {
    return new NotFoundException(error.message);
  }

  if (error instanceof TicketRelatedRecordsError || error instanceof TicketVersionConflictError) {
    return new ConflictException(error.message);
  }

  if (error instanceof TicketClientInactiveError || error instanceof TicketValidationError) {
    return new BadRequestException(error.message);
  }

  return error instanceof Error ? error : new Error("Ticket operation failed.");
}

function toTicketResponse(ticket: Ticket): TicketResponse {
  return {
    client: ticket.client,
    description: ticket.description,
    externalPriority: ticket.externalPriority,
    externalReference: ticket.externalReference,
    externalUrl: ticket.externalUrl,
    id: ticket.id,
    title: ticket.title,
    version: ticket.version,
  };
}
