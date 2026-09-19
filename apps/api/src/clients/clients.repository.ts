import { Inject, Injectable } from "@nestjs/common";

import {
  type Client,
  ClientCodeExhaustedError,
  ClientCodeSettingsNotFoundError,
  type ClientCodeSettings,
  type ClientList,
  type CreateClientRecordInput,
  type ListClientsQuery,
} from "./clients.contracts.js";

export const CLIENTS_DATABASE = Symbol("CLIENTS_DATABASE");

interface ClientsQueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

interface ClientsTransaction {
  query(query: string, values?: unknown[]): Promise<ClientsQueryResult>;
  release(): void;
}

export interface ClientsDatabase {
  connect(): Promise<ClientsTransaction>;
  query(query: string, values?: unknown[]): Promise<ClientsQueryResult>;
}

const clientSelection = `
  "id",
  "code",
  "name",
  "is_active",
  "version",
  "created_at",
  "created_by_user_id",
  "updated_at",
  "updated_by_user_id"
`;

const codeSettingsSelection = `
  "prefix",
  "code_length",
  "next_sequence",
  "version",
  "created_at",
  "created_by_user_id",
  "updated_at",
  "updated_by_user_id"
`;

const findCodeSettingsQuery = `
  select ${codeSettingsSelection}
  from "business"."client_code_settings"
  where "id" = true
`;

const findCodeSettingsForUpdateQuery = `${findCodeSettingsQuery} for update`;

const insertClientQuery = `
  insert into "business"."client" (
    "code",
    "name",
    "created_by_user_id",
    "updated_by_user_id"
  )
  values ($1, $2, $3, $4)
  returning ${clientSelection}
`;

const advanceCodeSettingsSequenceQuery = `
  update "business"."client_code_settings"
  set "next_sequence" = $1,
      "updated_at" = current_timestamp,
      "updated_by_user_id" = $2,
      "version" = "version" + 1
  where "id" = true
`;

const listClientsQuery = `
  select ${clientSelection}
  from "business"."client"
  where (
    $1::text is null
    or "code" ilike '%' || $1 || '%'
    or "name" ilike '%' || $1 || '%'
  )
  and ($2::boolean is null or "is_active" = $2)
  order by "code"
  limit $3 offset $4
`;

const countClientsQuery = `
  select count(*)::integer as "total"
  from "business"."client"
  where (
    $1::text is null
    or "code" ilike '%' || $1 || '%'
    or "name" ilike '%' || $1 || '%'
  )
  and ($2::boolean is null or "is_active" = $2)
`;

@Injectable()
export class ClientRepository {
  constructor(@Inject(CLIENTS_DATABASE) private readonly database: ClientsDatabase) {}

  async getCodeSettings(): Promise<ClientCodeSettings> {
    const result = await this.database.query(findCodeSettingsQuery);
    const row = result.rows[0];

    if (!row) {
      throw new ClientCodeSettingsNotFoundError("Client code settings do not exist.");
    }

    return readCodeSettings(row);
  }

  async createClient(input: CreateClientRecordInput): Promise<Client> {
    const transaction = await this.database.connect();

    try {
      await transaction.query("BEGIN");
      const settingsResult = await transaction.query(findCodeSettingsForUpdateQuery);
      const settingsRow = settingsResult.rows[0];

      if (!settingsRow) {
        throw new ClientCodeSettingsNotFoundError("Client code settings do not exist.");
      }

      const settings = readCodeSettings(settingsRow);
      const code = formatClientCode(settings);
      const createdResult = await transaction.query(insertClientQuery, [
        code,
        input.name,
        input.actorUserId,
        input.actorUserId,
      ]);
      const createdRow = createdResult.rows[0];

      if (!createdRow) {
        throw new Error("The business database did not return the created Client.");
      }

      await transaction.query(advanceCodeSettingsSequenceQuery, [
        (settings.nextSequence + 1n).toString(),
        input.actorUserId,
      ]);
      await transaction.query("COMMIT");

      return readClient(createdRow);
    } catch (error) {
      await transaction.query("ROLLBACK");
      throw error;
    } finally {
      transaction.release();
    }
  }

  async listClients(query: ListClientsQuery): Promise<ClientList> {
    const offset = (query.page - 1) * query.pageSize;
    const values = [query.query, query.isActive];
    const [clientsResult, countResult] = await Promise.all([
      this.database.query(listClientsQuery, [...values, query.pageSize, offset]),
      this.database.query(countClientsQuery, values),
    ]);
    const countRow = countResult.rows[0];

    if (!countRow) {
      throw new Error("The business database did not return the Client count.");
    }

    return {
      clients: clientsResult.rows.map(readClient),
      page: query.page,
      pageSize: query.pageSize,
      total: readPositiveOrZeroInteger(countRow.total, "Client count"),
    };
  }
}

export function formatClientCode(settings: Pick<ClientCodeSettings, "codeLength" | "nextSequence" | "prefix">): string {
  const sequenceWidth = settings.codeLength - settings.prefix.length;
  const sequence = settings.nextSequence.toString();

  if (sequenceWidth < 1 || sequence.length > sequenceWidth) {
    throw new ClientCodeExhaustedError(
      "The next Client sequence does not fit the configured code length.",
    );
  }

  return `${settings.prefix}-${sequence.padStart(sequenceWidth, "0")}`;
}

function readClient(row: Record<string, unknown>): Client {
  return {
    code: readString(row.code, "Client code"),
    createdAt: readDate(row.created_at, "Client creation date"),
    createdByUserId: readString(row.created_by_user_id, "Client creator"),
    id: readString(row.id, "Client id"),
    isActive: readBoolean(row.is_active, "Client active state"),
    name: readString(row.name, "Client name"),
    updatedAt: readDate(row.updated_at, "Client update date"),
    updatedByUserId: readString(row.updated_by_user_id, "Client updater"),
    version: readPositiveInteger(row.version, "Client version"),
  };
}

function readCodeSettings(row: Record<string, unknown>): ClientCodeSettings {
  return {
    codeLength: readPositiveInteger(row.code_length, "Client code length"),
    createdAt: readDate(row.created_at, "Client code settings creation date"),
    createdByUserId: readNullableString(row.created_by_user_id, "Client code settings creator"),
    nextSequence: readPositiveBigInt(row.next_sequence, "Client next sequence"),
    prefix: readString(row.prefix, "Client code prefix"),
    updatedAt: readDate(row.updated_at, "Client code settings update date"),
    updatedByUserId: readNullableString(row.updated_by_user_id, "Client code settings updater"),
    version: readPositiveInteger(row.version, "Client code settings version"),
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

function readNullableString(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }

  return readString(value, field);
}

function readPositiveBigInt(value: unknown, field: string): bigint {
  const parsedValue =
    typeof value === "bigint"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? BigInt(value)
        : null;

  if (parsedValue === null || parsedValue < 1n) {
    throw new Error(`Invalid ${field} returned by the business database.`);
  }

  return parsedValue;
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
