import { Inject, Injectable } from "@nestjs/common";

import {
  type CreateRequirementRecordInput,
  type ListRequirementsQuery,
  type Requirement,
  RequirementClientInactiveError,
  RequirementClientNotFoundError,
  RequirementCodeExhaustedError,
  RequirementCodeSettingsNotFoundError,
  RequirementCodeSettingsVersionConflictError,
  type RequirementCodeSettings,
  type RequirementList,
  RequirementNotFoundError,
  RequirementRelatedRecordsError,
  RequirementValidationError,
  RequirementVersionConflictError,
  type UpdateRequirementCodeSettingsRecordInput,
  type UpdateRequirementRecordInput,
} from "./requirements.contracts.js";

export const REQUIREMENTS_DATABASE = Symbol("REQUIREMENTS_DATABASE");

interface RequirementsQueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

interface RequirementsTransaction {
  query(query: string, values?: unknown[]): Promise<RequirementsQueryResult>;
  release(): void;
}

export interface RequirementsDatabase {
  connect(): Promise<RequirementsTransaction>;
  query(query: string, values?: unknown[]): Promise<RequirementsQueryResult>;
}

const requirementRecordSelection = (table: string) => `
  "${table}"."id",
  "${table}"."code",
  "${table}"."name",
  "${table}"."description",
  "${table}"."status",
  "${table}"."paused_from_status",
  "${table}"."requested_on",
  "${table}"."committed_on",
  "${table}"."quoted_on",
  "${table}"."approved_on",
  "${table}"."approved_by_user_id",
  "${table}"."version",
  "${table}"."created_at",
  "${table}"."created_by_user_id",
  "${table}"."updated_at",
  "${table}"."updated_by_user_id"
`;

const requirementSelection = (table: string) => `
  ${requirementRecordSelection(table)},
  "client"."id" as "client_id",
  "client"."code" as "client_code",
  "client"."name" as "client_name",
  "approver"."name" as "approved_by_user_name"
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

const findRequirementByIdQuery = `
  select ${requirementSelection("requirement")}
  from "business"."requirement" as "requirement"
  inner join "business"."client" as "client" on "client"."id" = "requirement"."client_id"
  left join "auth"."user" as "approver" on "approver"."id" = "requirement"."approved_by_user_id"
  where "requirement"."id" = $1
`;

const listRequirementsQuery = `
  select ${requirementSelection("requirement")}
  from "business"."requirement" as "requirement"
  inner join "business"."client" as "client" on "client"."id" = "requirement"."client_id"
  left join "auth"."user" as "approver" on "approver"."id" = "requirement"."approved_by_user_id"
  where (
    $1::text is null
    or "requirement"."code" ilike '%' || $1 || '%'
    or "requirement"."name" ilike '%' || $1 || '%'
  )
  and ($2::uuid is null or "requirement"."client_id" = $2)
  and ($3::text is null or "requirement"."status" = $3)
  order by "requirement"."updated_at" desc, "requirement"."id" desc
  limit $4 offset $5
`;

const countRequirementsQuery = `
  select count(*)::integer as "total"
  from "business"."requirement" as "requirement"
  where (
    $1::text is null
    or "requirement"."code" ilike '%' || $1 || '%'
    or "requirement"."name" ilike '%' || $1 || '%'
  )
  and ($2::uuid is null or "requirement"."client_id" = $2)
  and ($3::text is null or "requirement"."status" = $3)
`;

const findClientForRequirementCreationQuery = `
  select "is_active"
  from "business"."client"
  where "id" = $1
  for update
`;

const findCodeSettingsQuery = `
  select ${codeSettingsSelection}
  from "business"."entity_code_settings"
  where "entity_type" = 'requirement'
`;

const findCodeSettingsForUpdateQuery = `${findCodeSettingsQuery} for update`;

const insertRequirementQuery = `
  with "created" as (
    insert into "business"."requirement" (
      "code",
      "client_id",
      "name",
      "description",
      "status",
      "requested_on",
      "committed_on",
      "created_by_user_id",
      "updated_by_user_id"
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    returning *
  )
  select ${requirementSelection("created")}
  from "created"
  inner join "business"."client" as "client" on "client"."id" = "created"."client_id"
  left join "auth"."user" as "approver" on "approver"."id" = "created"."approved_by_user_id"
`;

const advanceCodeSettingsSequenceQuery = `
  update "business"."entity_code_settings"
  set "next_sequence" = $1,
      "updated_at" = current_timestamp,
      "updated_by_user_id" = $2,
      "version" = "version" + 1
  where "entity_type" = 'requirement'
`;

const updateRequirementQuery = `
  with "updated" as (
    update "business"."requirement"
    set "name" = coalesce($2::varchar, "name"),
        "description" = case when $3::boolean then $4::varchar else "description" end,
        "requested_on" = coalesce($5::date, "requested_on"),
        "committed_on" = case when $6::boolean then $7::date else "committed_on" end,
        "quoted_on" = case when $8::boolean then $9::date else "quoted_on" end,
        "approved_on" = case when $10::boolean then $11::date else "approved_on" end,
        "approved_by_user_id" = coalesce($12::text, "approved_by_user_id"),
        "status" = coalesce($13::text, "status"),
        "paused_from_status" = $14::text,
        "updated_at" = current_timestamp,
        "updated_by_user_id" = $15,
        "version" = "version" + 1
    where "id" = $1 and "version" = $16
    returning *
  )
  select ${requirementSelection("updated")}
  from "updated"
  inner join "business"."client" as "client" on "client"."id" = "updated"."client_id"
  left join "auth"."user" as "approver" on "approver"."id" = "updated"."approved_by_user_id"
`;

const deleteRequirementQuery = `
  delete from "business"."requirement"
  where "id" = $1
  returning "id"
`;

const updateCodeSettingsQuery = `
  update "business"."entity_code_settings"
  set "prefix" = $1,
      "code_length" = $2,
      "next_sequence" = $3,
      "updated_at" = current_timestamp,
      "updated_by_user_id" = $4,
      "version" = "version" + 1
  where "entity_type" = 'requirement'
  returning ${codeSettingsSelection}
`;

@Injectable()
export class RequirementRepository {
  constructor(@Inject(REQUIREMENTS_DATABASE) private readonly database: RequirementsDatabase) {}

  async getCodeSettings(): Promise<RequirementCodeSettings> {
    const result = await this.database.query(findCodeSettingsQuery);
    const row = result.rows[0];

    if (!row) {
      throw new RequirementCodeSettingsNotFoundError("Requirement code settings do not exist.");
    }

    return readCodeSettings(row);
  }

  async getRequirement(requirementId: string): Promise<Requirement> {
    const result = await this.database.query(findRequirementByIdQuery, [requirementId]);
    const row = result.rows[0];

    if (!row) {
      throw new RequirementNotFoundError(`Requirement ${requirementId} does not exist.`);
    }

    return readRequirement(row);
  }

  async listRequirements(query: ListRequirementsQuery): Promise<RequirementList> {
    const offset = (query.page - 1) * query.pageSize;
    const values = [query.query, query.clientId, query.status];
    const [requirementsResult, countResult] = await Promise.all([
      this.database.query(listRequirementsQuery, [...values, query.pageSize, offset]),
      this.database.query(countRequirementsQuery, values),
    ]);
    const countRow = countResult.rows[0];

    if (!countRow) {
      throw new Error("The business database did not return the Requirement count.");
    }

    return {
      page: query.page,
      pageSize: query.pageSize,
      requirements: requirementsResult.rows.map(readRequirement),
      total: readPositiveOrZeroInteger(countRow.total, "Requirement count"),
    };
  }

  async createRequirement(input: CreateRequirementRecordInput): Promise<Requirement> {
    const transaction = await this.database.connect();

    try {
      await transaction.query("BEGIN");
      const clientResult = await transaction.query(findClientForRequirementCreationQuery, [
        input.clientId,
      ]);
      const clientRow = clientResult.rows[0];

      if (!clientRow) {
        throw new RequirementClientNotFoundError(`Client ${input.clientId} does not exist.`);
      }

      if (!readBoolean(clientRow.is_active, "Client active state")) {
        throw new RequirementClientInactiveError(
          "Requirements can only be created for active Clients.",
        );
      }

      const settingsResult = await transaction.query(findCodeSettingsForUpdateQuery);
      const settingsRow = settingsResult.rows[0];

      if (!settingsRow) {
        throw new RequirementCodeSettingsNotFoundError("Requirement code settings do not exist.");
      }

      const settings = readCodeSettings(settingsRow);
      const code = formatRequirementCode(settings);
      const createdResult = await transaction.query(insertRequirementQuery, [
        code,
        input.clientId,
        input.name,
        input.description,
        input.status,
        input.requestedOn,
        input.committedOn,
        input.actorUserId,
        input.actorUserId,
      ]);
      const createdRow = createdResult.rows[0];

      if (!createdRow) {
        throw new Error("The business database did not return the created Requirement.");
      }

      await transaction.query(advanceCodeSettingsSequenceQuery, [
        (settings.nextSequence + 1n).toString(),
        input.actorUserId,
      ]);
      await transaction.query("COMMIT");

      return readRequirement(createdRow);
    } catch (error) {
      await transaction.query("ROLLBACK");
      throw error;
    } finally {
      transaction.release();
    }
  }

  async updateRequirement(
    requirementId: string,
    input: UpdateRequirementRecordInput,
  ): Promise<Requirement> {
    try {
      const result = await this.database.query(updateRequirementQuery, [
        requirementId,
        input.name ?? null,
        input.description !== undefined,
        input.description ?? null,
        input.requestedOn ?? null,
        input.committedOn !== undefined,
        input.committedOn ?? null,
        input.quotedOn !== undefined,
        input.quotedOn ?? null,
        input.approvedOn !== undefined,
        input.approvedOn ?? null,
        input.approvedByUserId ?? null,
        input.status ?? null,
        input.pausedFromStatus,
        input.actorUserId,
        input.version,
      ]);
      const row = result.rows[0];

      if (row) {
        return readRequirement(row);
      }
    } catch (error) {
      if (isCheckViolation(error)) {
        throw new RequirementValidationError(
          "The Requirement data does not satisfy its business rules.",
        );
      }

      throw error;
    }

    const currentResult = await this.database.query(findRequirementByIdQuery, [requirementId]);

    if (!currentResult.rows[0]) {
      throw new RequirementNotFoundError(`Requirement ${requirementId} does not exist.`);
    }

    throw new RequirementVersionConflictError(
      "The Requirement was updated by another person. Reload it before saving again.",
    );
  }

  async deleteRequirement(requirementId: string): Promise<void> {
    try {
      const result = await this.database.query(deleteRequirementQuery, [requirementId]);

      if (!result.rows[0]) {
        throw new RequirementNotFoundError(`Requirement ${requirementId} does not exist.`);
      }
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new RequirementRelatedRecordsError(
          "A Requirement with related business records cannot be deleted.",
        );
      }

      throw error;
    }
  }

  async updateCodeSettings(
    input: UpdateRequirementCodeSettingsRecordInput,
  ): Promise<RequirementCodeSettings> {
    const transaction = await this.database.connect();

    try {
      await transaction.query("BEGIN");
      const currentResult = await transaction.query(findCodeSettingsForUpdateQuery);
      const currentRow = currentResult.rows[0];

      if (!currentRow) {
        throw new RequirementCodeSettingsNotFoundError("Requirement code settings do not exist.");
      }

      const currentSettings = readCodeSettings(currentRow);

      if (currentSettings.version !== input.version) {
        throw new RequirementCodeSettingsVersionConflictError(
          "The Requirement code settings were updated by another person. Reload them before saving again.",
        );
      }

      if (input.nextSequence < currentSettings.nextSequence) {
        throw new RequirementValidationError(
          "The next Requirement sequence cannot be reduced below the last reserved sequence.",
        );
      }

      const updatedResult = await transaction.query(updateCodeSettingsQuery, [
        input.prefix,
        input.codeLength,
        input.nextSequence.toString(),
        input.actorUserId,
      ]);
      const updatedRow = updatedResult.rows[0];

      if (!updatedRow) {
        throw new Error(
          "The business database did not return the updated Requirement code settings.",
        );
      }

      await transaction.query("COMMIT");

      return readCodeSettings(updatedRow);
    } catch (error) {
      await transaction.query("ROLLBACK");
      throw error;
    } finally {
      transaction.release();
    }
  }
}

export function formatRequirementCode(
  settings: Pick<RequirementCodeSettings, "codeLength" | "nextSequence" | "prefix">,
): string {
  const sequenceWidth = settings.codeLength - settings.prefix.length;
  const sequence = settings.nextSequence.toString();

  if (sequenceWidth < 1 || sequence.length > sequenceWidth) {
    throw new RequirementCodeExhaustedError(
      "The next Requirement sequence does not fit the configured code length.",
    );
  }

  return `${settings.prefix}-${sequence.padStart(sequenceWidth, "0")}`;
}

function readRequirement(row: Record<string, unknown>): Requirement {
  return {
    approvedByUserId: readNullableString(row.approved_by_user_id, "Requirement approver"),
    approvedByUserName: readNullableString(row.approved_by_user_name, "Requirement approver name"),
    approvedOn: readNullableDateOnly(row.approved_on, "Requirement approval date"),
    client: {
      code: readString(row.client_code, "Requirement Client code"),
      id: readString(row.client_id, "Requirement Client id"),
      name: readString(row.client_name, "Requirement Client name"),
    },
    code: readString(row.code, "Requirement code"),
    committedOn: readNullableDateOnly(row.committed_on, "Requirement committed date"),
    createdAt: readDate(row.created_at, "Requirement creation date"),
    createdByUserId: readString(row.created_by_user_id, "Requirement creator"),
    description: readNullableString(row.description, "Requirement description"),
    id: readString(row.id, "Requirement id"),
    name: readString(row.name, "Requirement name"),
    pausedFromStatus: readPausedFromStatus(row.paused_from_status),
    quotedOn: readNullableDateOnly(row.quoted_on, "Requirement quoted date"),
    requestedOn: readDateOnly(row.requested_on, "Requirement requested date"),
    status: readRequirementStatus(row.status),
    updatedAt: readDate(row.updated_at, "Requirement update date"),
    updatedByUserId: readString(row.updated_by_user_id, "Requirement updater"),
    version: readPositiveInteger(row.version, "Requirement version"),
  };
}

function readCodeSettings(row: Record<string, unknown>): RequirementCodeSettings {
  return {
    codeLength: readPositiveInteger(row.code_length, "Requirement code length"),
    createdAt: readDate(row.created_at, "Requirement code settings creation date"),
    createdByUserId: readNullableString(
      row.created_by_user_id,
      "Requirement code settings creator",
    ),
    nextSequence: readPositiveBigInt(row.next_sequence, "Requirement next sequence"),
    prefix: readString(row.prefix, "Requirement code prefix"),
    updatedAt: readDate(row.updated_at, "Requirement code settings update date"),
    updatedByUserId: readNullableString(
      row.updated_by_user_id,
      "Requirement code settings updater",
    ),
    version: readPositiveInteger(row.version, "Requirement code settings version"),
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

function readDateOnly(value: unknown, field: string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  throw new Error(`Invalid ${field} returned by the business database.`);
}

function readNullableDateOnly(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }

  return readDateOnly(value, field);
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

function readRequirementStatus(value: unknown): Requirement["status"] {
  if (
    value !== "new" &&
    value !== "in_analysis" &&
    value !== "quoted" &&
    value !== "approved" &&
    value !== "in_execution" &&
    value !== "finalized" &&
    value !== "paused" &&
    value !== "cancelled"
  ) {
    throw new Error("Invalid Requirement status returned by the business database.");
  }

  return value;
}

function readPausedFromStatus(value: unknown): Requirement["pausedFromStatus"] {
  if (value === null) {
    return null;
  }

  if (
    value !== "new" &&
    value !== "in_analysis" &&
    value !== "quoted" &&
    value !== "approved" &&
    value !== "in_execution"
  ) {
    throw new Error("Invalid Requirement paused-from status returned by the business database.");
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
