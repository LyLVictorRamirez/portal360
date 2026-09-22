import { Inject, Injectable } from "@nestjs/common";

import {
  type CreateProjectRecordInput,
  type CreateProjectStageRecordInput,
  type DeleteProjectStageRecordInput,
  type ListProjectsQuery,
  type Project,
  ProjectClientInactiveError,
  ProjectClientNotFoundError,
  ProjectCodeExhaustedError,
  ProjectCodeSettingsNotFoundError,
  ProjectCodeSettingsVersionConflictError,
  type ProjectCodeSettings,
  type ProjectDetail,
  type ProjectList,
  ProjectNotFoundError,
  ProjectRelatedRecordsError,
  ProjectStageNameConflictError,
  ProjectStageNotFoundError,
  ProjectStageOrderError,
  ProjectStageRelatedRecordsError,
  type ProjectStage,
  ProjectStageVersionConflictError,
  ProjectTerminalStatusError,
  ProjectValidationError,
  ProjectVersionConflictError,
  type MoveProjectStageRecordInput,
  type UpdateProjectCodeSettingsRecordInput,
  type UpdateProjectRecordInput,
  type UpdateProjectStageRecordInput,
} from "./projects.contracts.js";

export const PROJECTS_DATABASE = Symbol("PROJECTS_DATABASE");

interface ProjectsQueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

interface ProjectsTransaction {
  query(query: string, values?: unknown[]): Promise<ProjectsQueryResult>;
  release(): void;
}

export interface ProjectsDatabase {
  connect(): Promise<ProjectsTransaction>;
  query(query: string, values?: unknown[]): Promise<ProjectsQueryResult>;
}

const projectRecordSelection = (table: string) => `
  "${table}"."id",
  "${table}"."code",
  "${table}"."name",
  "${table}"."description",
  "${table}"."start_date",
  "${table}"."committed_end_date",
  "${table}"."status",
  "${table}"."version",
  "${table}"."created_at",
  "${table}"."created_by_user_id",
  "${table}"."updated_at",
  "${table}"."updated_by_user_id"
`;

const projectSelection = (table: string) => `
  ${projectRecordSelection(table)},
  "client"."id" as "client_id",
  "client"."code" as "client_code",
  "client"."name" as "client_name"
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

const findProjectByIdQuery = `
  select ${projectSelection("project")}
  from "business"."project" as "project"
  inner join "business"."client" as "client" on "client"."id" = "project"."client_id"
  where "project"."id" = $1
`;

const projectStageSelection = (table: string) => `
  "${table}"."id",
  "${table}"."name",
  "${table}"."position",
  "${table}"."version",
  "${table}"."created_at",
  "${table}"."created_by_user_id",
  "${table}"."updated_at",
  "${table}"."updated_by_user_id"
`;

const findProjectStagesQuery = `
  select ${projectStageSelection("stage")}
  from "business"."project_stage" as "stage"
  where "stage"."project_id" = $1
  order by "stage"."position" asc, "stage"."id" asc
`;

const findProjectForStageMutationQuery = `
  select "id", "status"
  from "business"."project"
  where "id" = $1
  for update
`;

const findProjectStageForMutationQuery = `
  select
    ${projectStageSelection("stage")},
    "project"."status" as "project_status"
  from "business"."project_stage" as "stage"
  inner join "business"."project" as "project" on "project"."id" = "stage"."project_id"
  where "stage"."id" = $1 and "stage"."project_id" = $2
  for update of "stage", "project"
`;

const findLastProjectStagePositionQuery = `
  select "position"
  from "business"."project_stage"
  where "project_id" = $1
  order by "position" desc
  limit 1
  for update
`;

const insertProjectStageQuery = `
  insert into "business"."project_stage" (
    "project_id",
    "name",
    "position",
    "created_by_user_id",
    "updated_by_user_id"
  )
  values ($1, $2, $3, $4, $4)
  returning ${projectStageSelection("project_stage")}
`;

const updateProjectStageQuery = `
  update "business"."project_stage"
  set "name" = $3,
      "updated_at" = current_timestamp,
      "updated_by_user_id" = $4,
      "version" = "version" + 1
  where "id" = $1 and "project_id" = $2
  returning ${projectStageSelection("project_stage")}
`;

const findProjectStageNeighborQuery = `
  select ${projectStageSelection("stage")}
  from "business"."project_stage" as "stage"
  where "stage"."project_id" = $1
    and "stage"."position" = $2
  for update
`;

const reserveProjectStagePositionQuery = `
  select coalesce(max("position"), 0) + 1 as "position"
  from "business"."project_stage"
  where "project_id" = $1
`;

const setProjectStagePositionQuery = `
  update "business"."project_stage"
  set "position" = $3,
      "updated_at" = current_timestamp,
      "updated_by_user_id" = $4,
      "version" = "version" + 1
  where "id" = $1 and "project_id" = $2
  returning ${projectStageSelection("project_stage")}
`;

const setProjectStageTemporaryPositionQuery = `
  update "business"."project_stage"
  set "position" = $3
  where "id" = $1 and "project_id" = $2
`;

const deleteProjectStageQuery = `
  delete from "business"."project_stage"
  where "id" = $1 and "project_id" = $2
  returning "id"
`;

const listProjectsQuery = `
  select ${projectSelection("project")}
  from "business"."project" as "project"
  inner join "business"."client" as "client" on "client"."id" = "project"."client_id"
  where (
    $1::text is null
    or "project"."code" ilike '%' || $1 || '%'
    or "project"."name" ilike '%' || $1 || '%'
  )
  and ($2::uuid is null or "project"."client_id" = $2)
  and ($3::text is null or "project"."status" = $3)
  order by "project"."updated_at" desc, "project"."id" desc
  limit $4 offset $5
`;

const countProjectsQuery = `
  select count(*)::integer as "total"
  from "business"."project" as "project"
  where (
    $1::text is null
    or "project"."code" ilike '%' || $1 || '%'
    or "project"."name" ilike '%' || $1 || '%'
  )
  and ($2::uuid is null or "project"."client_id" = $2)
  and ($3::text is null or "project"."status" = $3)
`;

const findClientForProjectCreationQuery = `
  select "is_active"
  from "business"."client"
  where "id" = $1
  for update
`;

const findCodeSettingsQuery = `
  select ${codeSettingsSelection}
  from "business"."entity_code_settings"
  where "entity_type" = 'project'
`;

const findCodeSettingsForUpdateQuery = `${findCodeSettingsQuery} for update`;

const insertProjectQuery = `
  with "created" as (
    insert into "business"."project" (
      "code",
      "client_id",
      "name",
      "description",
      "start_date",
      "committed_end_date",
      "status",
      "created_by_user_id",
      "updated_by_user_id"
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    returning *
  )
  select ${projectSelection("created")}
  from "created"
  inner join "business"."client" as "client" on "client"."id" = "created"."client_id"
`;

const advanceCodeSettingsSequenceQuery = `
  update "business"."entity_code_settings"
  set "next_sequence" = $1,
      "updated_at" = current_timestamp,
      "updated_by_user_id" = $2,
      "version" = "version" + 1
  where "entity_type" = 'project'
`;

const updateProjectQuery = `
  with "updated" as (
    update "business"."project"
    set "name" = coalesce($2::varchar, "name"),
        "description" = case when $3::boolean then $4::varchar else "description" end,
        "start_date" = coalesce($5::date, "start_date"),
        "committed_end_date" = coalesce($6::date, "committed_end_date"),
        "status" = coalesce($7::text, "status"),
        "updated_at" = current_timestamp,
        "updated_by_user_id" = $8,
        "version" = "version" + 1
    where "id" = $1 and "version" = $9
    returning *
  )
  select ${projectSelection("updated")}
  from "updated"
  inner join "business"."client" as "client" on "client"."id" = "updated"."client_id"
`;

const deleteProjectQuery = `
  delete from "business"."project"
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
  where "entity_type" = 'project'
  returning ${codeSettingsSelection}
`;

@Injectable()
export class ProjectRepository {
  constructor(@Inject(PROJECTS_DATABASE) private readonly database: ProjectsDatabase) {}

  async getCodeSettings(): Promise<ProjectCodeSettings> {
    const result = await this.database.query(findCodeSettingsQuery);
    const row = result.rows[0];

    if (!row) {
      throw new ProjectCodeSettingsNotFoundError("Project code settings do not exist.");
    }

    return readCodeSettings(row);
  }

  async getProject(projectId: string): Promise<ProjectDetail> {
    const result = await this.database.query(findProjectByIdQuery, [projectId]);
    const row = result.rows[0];

    if (!row) {
      throw new ProjectNotFoundError(`Project ${projectId} does not exist.`);
    }

    const stagesResult = await this.database.query(findProjectStagesQuery, [projectId]);

    return {
      ...readProject(row),
      stages: stagesResult.rows.map(readProjectStage),
    };
  }

  async listProjects(query: ListProjectsQuery): Promise<ProjectList> {
    const offset = (query.page - 1) * query.pageSize;
    const values = [query.query, query.clientId, query.status];
    const [projectsResult, countResult] = await Promise.all([
      this.database.query(listProjectsQuery, [...values, query.pageSize, offset]),
      this.database.query(countProjectsQuery, values),
    ]);
    const countRow = countResult.rows[0];

    if (!countRow) {
      throw new Error("The business database did not return the Project count.");
    }

    return {
      page: query.page,
      pageSize: query.pageSize,
      projects: projectsResult.rows.map(readProject),
      total: readPositiveOrZeroInteger(countRow.total, "Project count"),
    };
  }

  async createProject(input: CreateProjectRecordInput): Promise<Project> {
    const transaction = await this.database.connect();

    try {
      await transaction.query("BEGIN");
      const clientResult = await transaction.query(findClientForProjectCreationQuery, [
        input.clientId,
      ]);
      const clientRow = clientResult.rows[0];

      if (!clientRow) {
        throw new ProjectClientNotFoundError(`Client ${input.clientId} does not exist.`);
      }

      if (!readBoolean(clientRow.is_active, "Client active state")) {
        throw new ProjectClientInactiveError("Projects can only be created for active Clients.");
      }

      const settingsResult = await transaction.query(findCodeSettingsForUpdateQuery);
      const settingsRow = settingsResult.rows[0];

      if (!settingsRow) {
        throw new ProjectCodeSettingsNotFoundError("Project code settings do not exist.");
      }

      const settings = readCodeSettings(settingsRow);
      const code = formatProjectCode(settings);
      const createdResult = await transaction.query(insertProjectQuery, [
        code,
        input.clientId,
        input.name,
        input.description ?? null,
        input.startDate,
        input.committedEndDate,
        input.status,
        input.actorUserId,
        input.actorUserId,
      ]);
      const createdRow = createdResult.rows[0];

      if (!createdRow) {
        throw new Error("The business database did not return the created Project.");
      }

      await transaction.query(advanceCodeSettingsSequenceQuery, [
        (settings.nextSequence + 1n).toString(),
        input.actorUserId,
      ]);
      await transaction.query("COMMIT");

      return readProject(createdRow);
    } catch (error) {
      await transaction.query("ROLLBACK");
      throw error;
    } finally {
      transaction.release();
    }
  }

  async updateProject(projectId: string, input: UpdateProjectRecordInput): Promise<Project> {
    try {
      const result = await this.database.query(updateProjectQuery, [
        projectId,
        input.name ?? null,
        input.description !== undefined,
        input.description ?? null,
        input.startDate ?? null,
        input.committedEndDate ?? null,
        input.status ?? null,
        input.actorUserId,
        input.version,
      ]);
      const row = result.rows[0];

      if (row) {
        return readProject(row);
      }
    } catch (error) {
      if (isCheckViolation(error)) {
        throw new ProjectValidationError("The Project data does not satisfy its business rules.");
      }

      throw error;
    }

    const currentResult = await this.database.query(findProjectByIdQuery, [projectId]);

    if (!currentResult.rows[0]) {
      throw new ProjectNotFoundError(`Project ${projectId} does not exist.`);
    }

    throw new ProjectVersionConflictError(
      "The Project was updated by another person. Reload it before saving again.",
    );
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      const result = await this.database.query(deleteProjectQuery, [projectId]);

      if (!result.rows[0]) {
        throw new ProjectNotFoundError(`Project ${projectId} does not exist.`);
      }
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ProjectRelatedRecordsError(
          "A Project with related business records cannot be deleted.",
        );
      }

      throw error;
    }
  }

  async createProjectStage(
    projectId: string,
    input: CreateProjectStageRecordInput,
  ): Promise<ProjectStage> {
    const transaction = await this.database.connect();

    try {
      await transaction.query("BEGIN");
      await readProjectForStageMutation(transaction, projectId);
      const lastPositionResult = await transaction.query(findLastProjectStagePositionQuery, [
        projectId,
      ]);
      const lastPosition = lastPositionResult.rows[0]
        ? readPositiveInteger(lastPositionResult.rows[0].position, "Project Stage position")
        : 0;
      const createdResult = await transaction.query(insertProjectStageQuery, [
        projectId,
        input.name,
        lastPosition + 1,
        input.actorUserId,
      ]);
      const createdRow = createdResult.rows[0];

      if (!createdRow) {
        throw new Error("The business database did not return the created Project Stage.");
      }

      await transaction.query("COMMIT");
      return readProjectStage(createdRow);
    } catch (error) {
      await transaction.query("ROLLBACK");

      if (isUniqueViolation(error)) {
        throw new ProjectStageNameConflictError(
          "A Project Stage with that name or position already exists for this Project.",
        );
      }

      throw error;
    } finally {
      transaction.release();
    }
  }

  async updateProjectStage(
    projectId: string,
    stageId: string,
    input: UpdateProjectStageRecordInput,
  ): Promise<ProjectStage> {
    const transaction = await this.database.connect();

    try {
      await transaction.query("BEGIN");
      const stage = await readProjectStageForMutation(transaction, projectId, stageId);
      assertProjectStageVersion(stage, input.version);
      const updatedResult = await transaction.query(updateProjectStageQuery, [
        stageId,
        projectId,
        input.name,
        input.actorUserId,
      ]);
      const updatedRow = updatedResult.rows[0];

      if (!updatedRow) {
        throw new Error("The business database did not return the updated Project Stage.");
      }

      await transaction.query("COMMIT");
      return readProjectStage(updatedRow);
    } catch (error) {
      await transaction.query("ROLLBACK");

      if (isUniqueViolation(error)) {
        throw new ProjectStageNameConflictError(
          "A Project Stage with that name already exists for this Project.",
        );
      }

      throw error;
    } finally {
      transaction.release();
    }
  }

  async moveProjectStage(
    projectId: string,
    stageId: string,
    input: MoveProjectStageRecordInput,
  ): Promise<ProjectStage> {
    const transaction = await this.database.connect();

    try {
      await transaction.query("BEGIN");
      const stage = await readProjectStageForMutation(transaction, projectId, stageId);
      assertProjectStageVersion(stage, input.version);
      const neighborPosition = stage.position + (input.direction === "up" ? -1 : 1);

      if (neighborPosition < 1) {
        throw new ProjectStageOrderError("The first Project Stage cannot be moved up.");
      }

      const neighborResult = await transaction.query(findProjectStageNeighborQuery, [
        projectId,
        neighborPosition,
      ]);
      const neighborRow = neighborResult.rows[0];

      if (!neighborRow) {
        throw new ProjectStageOrderError("The last Project Stage cannot be moved down.");
      }

      const neighbor = readProjectStage(neighborRow);
      const temporaryPositionResult = await transaction.query(reserveProjectStagePositionQuery, [
        projectId,
      ]);
      const temporaryPositionRow = temporaryPositionResult.rows[0];

      if (!temporaryPositionRow) {
        throw new Error("The business database did not return a temporary Project Stage position.");
      }

      const temporaryPosition = readPositiveInteger(
        temporaryPositionRow.position,
        "Temporary Project Stage position",
      );
      await transaction.query(setProjectStageTemporaryPositionQuery, [
        stageId,
        projectId,
        temporaryPosition,
      ]);
      await transaction.query(setProjectStagePositionQuery, [
        neighbor.id,
        projectId,
        stage.position,
        input.actorUserId,
      ]);
      const movedResult = await transaction.query(setProjectStagePositionQuery, [
        stageId,
        projectId,
        neighbor.position,
        input.actorUserId,
      ]);
      const movedRow = movedResult.rows[0];

      if (!movedRow) {
        throw new Error("The business database did not return the moved Project Stage.");
      }

      await transaction.query("COMMIT");
      return readProjectStage(movedRow);
    } catch (error) {
      await transaction.query("ROLLBACK");
      throw error;
    } finally {
      transaction.release();
    }
  }

  async deleteProjectStage(
    projectId: string,
    stageId: string,
    input: DeleteProjectStageRecordInput,
  ): Promise<void> {
    const transaction = await this.database.connect();

    try {
      await transaction.query("BEGIN");
      const stage = await readProjectStageForMutation(transaction, projectId, stageId);
      assertProjectStageVersion(stage, input.version);
      const deletedResult = await transaction.query(deleteProjectStageQuery, [stageId, projectId]);

      if (!deletedResult.rows[0]) {
        throw new Error("The business database did not delete the Project Stage.");
      }

      await transaction.query("COMMIT");
    } catch (error) {
      await transaction.query("ROLLBACK");

      if (isForeignKeyViolation(error)) {
        throw new ProjectStageRelatedRecordsError(
          "A Project Stage with related Activities cannot be deleted.",
        );
      }

      throw error;
    } finally {
      transaction.release();
    }
  }

  async updateCodeSettings(
    input: UpdateProjectCodeSettingsRecordInput,
  ): Promise<ProjectCodeSettings> {
    const transaction = await this.database.connect();

    try {
      await transaction.query("BEGIN");
      const currentResult = await transaction.query(findCodeSettingsForUpdateQuery);
      const currentRow = currentResult.rows[0];

      if (!currentRow) {
        throw new ProjectCodeSettingsNotFoundError("Project code settings do not exist.");
      }

      const currentSettings = readCodeSettings(currentRow);

      if (currentSettings.version !== input.version) {
        throw new ProjectCodeSettingsVersionConflictError(
          "The Project code settings were updated by another person. Reload them before saving again.",
        );
      }

      if (input.nextSequence < currentSettings.nextSequence) {
        throw new ProjectValidationError(
          "The next Project sequence cannot be reduced below the last reserved sequence.",
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
        throw new Error("The business database did not return the updated Project code settings.");
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

export function formatProjectCode(
  settings: Pick<ProjectCodeSettings, "codeLength" | "nextSequence" | "prefix">,
): string {
  const sequenceWidth = settings.codeLength - settings.prefix.length;
  const sequence = settings.nextSequence.toString();

  if (sequenceWidth < 1 || sequence.length > sequenceWidth) {
    throw new ProjectCodeExhaustedError(
      "The next Project sequence does not fit the configured code length.",
    );
  }

  return `${settings.prefix}-${sequence.padStart(sequenceWidth, "0")}`;
}

function readProject(row: Record<string, unknown>): Project {
  return {
    client: {
      code: readString(row.client_code, "Project Client code"),
      id: readString(row.client_id, "Project Client id"),
      name: readString(row.client_name, "Project Client name"),
    },
    code: readString(row.code, "Project code"),
    committedEndDate: readDateOnly(row.committed_end_date, "Project committed end date"),
    createdAt: readDate(row.created_at, "Project creation date"),
    createdByUserId: readString(row.created_by_user_id, "Project creator"),
    description: readNullableString(row.description, "Project description"),
    id: readString(row.id, "Project id"),
    name: readString(row.name, "Project name"),
    startDate: readDateOnly(row.start_date, "Project start date"),
    status: readProjectStatus(row.status),
    updatedAt: readDate(row.updated_at, "Project update date"),
    updatedByUserId: readString(row.updated_by_user_id, "Project updater"),
    version: readPositiveInteger(row.version, "Project version"),
  };
}

function readProjectStage(row: Record<string, unknown>): ProjectStage {
  return {
    createdAt: readDate(row.created_at, "Project Stage creation date"),
    createdByUserId: readString(row.created_by_user_id, "Project Stage creator"),
    id: readString(row.id, "Project Stage id"),
    name: readString(row.name, "Project Stage name"),
    position: readPositiveInteger(row.position, "Project Stage position"),
    updatedAt: readDate(row.updated_at, "Project Stage update date"),
    updatedByUserId: readString(row.updated_by_user_id, "Project Stage updater"),
    version: readPositiveInteger(row.version, "Project Stage version"),
  };
}

async function readProjectForStageMutation(
  transaction: ProjectsTransaction,
  projectId: string,
): Promise<void> {
  const projectResult = await transaction.query(findProjectForStageMutationQuery, [projectId]);
  const projectRow = projectResult.rows[0];

  if (!projectRow) {
    throw new ProjectNotFoundError(`Project ${projectId} does not exist.`);
  }

  assertProjectAllowsStageChanges(projectRow.project_status ?? projectRow.status);
}

async function readProjectStageForMutation(
  transaction: ProjectsTransaction,
  projectId: string,
  stageId: string,
): Promise<ProjectStage> {
  const stageResult = await transaction.query(findProjectStageForMutationQuery, [stageId, projectId]);
  const stageRow = stageResult.rows[0];

  if (!stageRow) {
    throw new ProjectStageNotFoundError(
      `Project Stage ${stageId} does not exist in Project ${projectId}.`,
    );
  }

  assertProjectAllowsStageChanges(stageRow.project_status);
  return readProjectStage(stageRow);
}

function assertProjectAllowsStageChanges(status: unknown): void {
  const projectStatus = readProjectStatus(status);

  if (projectStatus === "finalized" || projectStatus === "cancelled") {
    throw new ProjectTerminalStatusError(
      "Project Stages cannot be changed when their Project is finalized or cancelled.",
    );
  }
}

function assertProjectStageVersion(stage: ProjectStage, expectedVersion: number): void {
  if (stage.version !== expectedVersion) {
    throw new ProjectStageVersionConflictError(
      "The Project Stage was updated by another person. Reload it before trying again.",
    );
  }
}

function readCodeSettings(row: Record<string, unknown>): ProjectCodeSettings {
  return {
    codeLength: readPositiveInteger(row.code_length, "Project code length"),
    createdAt: readDate(row.created_at, "Project code settings creation date"),
    createdByUserId: readNullableString(row.created_by_user_id, "Project code settings creator"),
    nextSequence: readPositiveBigInt(row.next_sequence, "Project next sequence"),
    prefix: readString(row.prefix, "Project code prefix"),
    updatedAt: readDate(row.updated_at, "Project code settings update date"),
    updatedByUserId: readNullableString(row.updated_by_user_id, "Project code settings updater"),
    version: readPositiveInteger(row.version, "Project code settings version"),
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

function readProjectStatus(value: unknown): Project["status"] {
  if (
    value !== "new" &&
    value !== "in_execution" &&
    value !== "paused" &&
    value !== "finalized" &&
    value !== "cancelled"
  ) {
    throw new Error("Invalid Project status returned by the business database.");
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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
