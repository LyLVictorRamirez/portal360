import { Inject, Injectable } from "@nestjs/common";

import {
  type CreateTicketRecordInput,
  type ListTicketsQuery,
  type Ticket,
  type TicketExternalPriority,
  ticketExternalPriorities,
  type TicketList,
  TicketClientInactiveError,
  TicketClientNotFoundError,
  TicketNotFoundError,
  TicketRelatedRecordsError,
  TicketValidationError,
  TicketVersionConflictError,
  type UpdateTicketRecordInput,
} from "./tickets.contracts.js";

export const TICKETS_DATABASE = Symbol("TICKETS_DATABASE");

interface TicketsQueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

interface TicketsTransaction {
  query(query: string, values?: unknown[]): Promise<TicketsQueryResult>;
  release(): void;
}

export interface TicketsDatabase {
  connect(): Promise<TicketsTransaction>;
  query(query: string, values?: unknown[]): Promise<TicketsQueryResult>;
}

const ticketRecordSelection = (table: string) => `
  "${table}"."id",
  "${table}"."external_reference",
  "${table}"."external_url",
  "${table}"."title",
  "${table}"."description",
  "${table}"."external_priority",
  "${table}"."version",
  "${table}"."created_at",
  "${table}"."created_by_user_id",
  "${table}"."updated_at",
  "${table}"."updated_by_user_id"
`;

const ticketSelection = (table: string) => `
  ${ticketRecordSelection(table)},
  "client"."id" as "client_id",
  "client"."code" as "client_code",
  "client"."name" as "client_name"
`;

const findTicketByIdQuery = `
  select ${ticketSelection("ticket")}
  from "business"."ticket" as "ticket"
  inner join "business"."client" as "client" on "client"."id" = "ticket"."client_id"
  where "ticket"."id" = $1
`;

const listTicketsQuery = `
  select ${ticketSelection("ticket")}
  from "business"."ticket" as "ticket"
  inner join "business"."client" as "client" on "client"."id" = "ticket"."client_id"
  where (
    $1::text is null
    or "ticket"."external_reference" ilike '%' || $1 || '%'
    or "ticket"."title" ilike '%' || $1 || '%'
  )
  and ($2::uuid is null or "ticket"."client_id" = $2)
  and ($3::text is null or "ticket"."external_priority" = $3)
  order by "ticket"."updated_at" desc, "ticket"."id" desc
  limit $4 offset $5
`;

const countTicketsQuery = `
  select count(*)::integer as "total"
  from "business"."ticket" as "ticket"
  where (
    $1::text is null
    or "ticket"."external_reference" ilike '%' || $1 || '%'
    or "ticket"."title" ilike '%' || $1 || '%'
  )
  and ($2::uuid is null or "ticket"."client_id" = $2)
  and ($3::text is null or "ticket"."external_priority" = $3)
`;

const findClientForTicketCreationQuery = `
  select "is_active"
  from "business"."client"
  where "id" = $1
  for update
`;

const insertTicketQuery = `
  with "created" as (
    insert into "business"."ticket" (
      "client_id",
      "external_reference",
      "external_url",
      "title",
      "description",
      "external_priority",
      "created_by_user_id",
      "updated_by_user_id"
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8)
    returning *
  )
  select ${ticketSelection("created")}
  from "created"
  inner join "business"."client" as "client" on "client"."id" = "created"."client_id"
`;

const updateTicketQuery = `
  with "updated" as (
    update "business"."ticket"
    set "external_reference" = coalesce($2::varchar, "external_reference"),
        "external_url" = case when $3::boolean then $4::varchar else "external_url" end,
        "title" = coalesce($5::varchar, "title"),
        "description" = case when $6::boolean then $7::varchar else "description" end,
        "external_priority" = coalesce($8::text, "external_priority"),
        "updated_at" = current_timestamp,
        "updated_by_user_id" = $9,
        "version" = "version" + 1
    where "id" = $1 and "version" = $10
    returning *
  )
  select ${ticketSelection("updated")}
  from "updated"
  inner join "business"."client" as "client" on "client"."id" = "updated"."client_id"
`;

const deleteTicketQuery = `
  delete from "business"."ticket"
  where "id" = $1
  returning "id"
`;

@Injectable()
export class TicketRepository {
  constructor(@Inject(TICKETS_DATABASE) private readonly database: TicketsDatabase) {}

  async createTicket(input: CreateTicketRecordInput): Promise<Ticket> {
    const transaction = await this.database.connect();

    try {
      await transaction.query("BEGIN");
      const clientResult = await transaction.query(findClientForTicketCreationQuery, [
        input.clientId,
      ]);
      const clientRow = clientResult.rows[0];

      if (!clientRow) {
        throw new TicketClientNotFoundError(`Client ${input.clientId} does not exist.`);
      }

      if (!readBoolean(clientRow.is_active, "Client active state")) {
        throw new TicketClientInactiveError("Tickets can only be created for active Clients.");
      }

      const createdResult = await transaction.query(insertTicketQuery, [
        input.clientId,
        input.externalReference,
        input.externalUrl,
        input.title,
        input.description,
        input.externalPriority,
        input.actorUserId,
        input.actorUserId,
      ]);
      const createdRow = createdResult.rows[0];

      if (!createdRow) {
        throw new Error("The business database did not return the created Ticket.");
      }

      await transaction.query("COMMIT");

      return readTicket(createdRow);
    } catch (error) {
      await transaction.query("ROLLBACK");
      throw error;
    } finally {
      transaction.release();
    }
  }

  async deleteTicket(ticketId: string): Promise<void> {
    try {
      const result = await this.database.query(deleteTicketQuery, [ticketId]);

      if (!result.rows[0]) {
        throw new TicketNotFoundError(`Ticket ${ticketId} does not exist.`);
      }
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new TicketRelatedRecordsError("A Ticket with related Activities cannot be deleted.");
      }

      throw error;
    }
  }

  async getTicket(ticketId: string): Promise<Ticket> {
    const result = await this.database.query(findTicketByIdQuery, [ticketId]);
    const row = result.rows[0];

    if (!row) {
      throw new TicketNotFoundError(`Ticket ${ticketId} does not exist.`);
    }

    return readTicket(row);
  }

  async listTickets(query: ListTicketsQuery): Promise<TicketList> {
    const offset = (query.page - 1) * query.pageSize;
    const values = [query.query, query.clientId, query.priority];
    const [ticketsResult, countResult] = await Promise.all([
      this.database.query(listTicketsQuery, [...values, query.pageSize, offset]),
      this.database.query(countTicketsQuery, values),
    ]);
    const countRow = countResult.rows[0];

    if (!countRow) {
      throw new Error("The business database did not return the Ticket count.");
    }

    return {
      page: query.page,
      pageSize: query.pageSize,
      tickets: ticketsResult.rows.map(readTicket),
      total: readPositiveOrZeroInteger(countRow.total, "Ticket count"),
    };
  }

  async updateTicket(ticketId: string, input: UpdateTicketRecordInput): Promise<Ticket> {
    try {
      const result = await this.database.query(updateTicketQuery, [
        ticketId,
        input.externalReference ?? null,
        input.externalUrl !== undefined,
        input.externalUrl ?? null,
        input.title ?? null,
        input.description !== undefined,
        input.description ?? null,
        input.externalPriority ?? null,
        input.actorUserId,
        input.version,
      ]);
      const row = result.rows[0];

      if (row) {
        return readTicket(row);
      }
    } catch (error) {
      if (isCheckViolation(error)) {
        throw new TicketValidationError("The Ticket data does not satisfy its business rules.");
      }

      throw error;
    }

    const currentResult = await this.database.query(findTicketByIdQuery, [ticketId]);

    if (!currentResult.rows[0]) {
      throw new TicketNotFoundError(`Ticket ${ticketId} does not exist.`);
    }

    throw new TicketVersionConflictError(
      "The Ticket was updated by another person. Reload it before saving again.",
    );
  }
}

function readTicket(row: Record<string, unknown>): Ticket {
  return {
    client: {
      code: readString(row.client_code, "Ticket Client code"),
      id: readString(row.client_id, "Ticket Client id"),
      name: readString(row.client_name, "Ticket Client name"),
    },
    createdAt: readDate(row.created_at, "Ticket creation date"),
    createdByUserId: readString(row.created_by_user_id, "Ticket creator"),
    description: readNullableString(row.description, "Ticket description"),
    externalPriority: readExternalPriority(row.external_priority),
    externalReference: readString(row.external_reference, "Ticket external reference"),
    externalUrl: readNullableString(row.external_url, "Ticket external URL"),
    id: readString(row.id, "Ticket id"),
    title: readString(row.title, "Ticket title"),
    updatedAt: readDate(row.updated_at, "Ticket update date"),
    updatedByUserId: readString(row.updated_by_user_id, "Ticket updater"),
    version: readPositiveInteger(row.version, "Ticket version"),
  };
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${field} returned by the business database.`);
  }

  return value;
}

function readDate(value: unknown, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`Invalid ${field} returned by the business database.`);
  }

  return value;
}

function readExternalPriority(value: unknown): TicketExternalPriority {
  if (!(ticketExternalPriorities as readonly string[]).includes(value as string)) {
    throw new Error("Invalid Ticket priority returned by the business database.");
  }

  return value as TicketExternalPriority;
}

function readNullableString(value: unknown, field: string): string | null {
  return value === null ? null : readString(value, field);
}

function readPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Invalid ${field} returned by the business database.`);
  }

  return value;
}

function readPositiveOrZeroInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${field} returned by the business database.`);
  }

  return value;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid ${field} returned by the business database.`);
  }

  return value;
}

function isCheckViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23514"
  );
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23503"
  );
}
