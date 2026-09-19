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
} from "@nestjs/common";

import { AuthorizationContext } from "../authorization/authorization-context.decorator.js";
import type { AuthorizationRequestContext } from "../authorization/authorization.types.js";
import {
  type CreateProjectInput,
  type ListProjectsInput,
  type Project,
  ProjectClientInactiveError,
  ProjectClientNotFoundError,
  ProjectCodeExhaustedError,
  ProjectCodeSettingsNotFoundError,
  ProjectCodeSettingsVersionConflictError,
  type ProjectCodeSettings,
  type ProjectList,
  type ProjectStatus,
  type ProjectStatusFilter,
  ProjectNotFoundError,
  ProjectRelatedRecordsError,
  ProjectValidationError,
  ProjectVersionConflictError,
  type UpdateProjectCodeSettingsInput,
  type UpdateProjectInput,
} from "./projects.contracts.js";
import { ProjectService } from "./projects.service.js";

interface ProjectResponse {
  client: {
    code: string;
    id: string;
    name: string;
  };
  code: string;
  committedEndDate: string;
  description: string | null;
  id: string;
  name: string;
  startDate: string;
  status: ProjectStatus;
  version: number;
}

interface ProjectCodeSettingsResponse {
  codeLength: number;
  nextSequence: string;
  prefix: string;
  version: number;
}

export interface ProjectsControllerStore {
  createProject(input: CreateProjectInput, actorUserId: string): Promise<Project>;
  deleteProject(projectId: string): Promise<void>;
  getCodeSettings(): Promise<ProjectCodeSettings>;
  getProject(projectId: string): Promise<Project>;
  listProjects(input: ListProjectsInput): Promise<ProjectList>;
  updateCodeSettings(
    input: UpdateProjectCodeSettingsInput,
    actorUserId: string,
  ): Promise<ProjectCodeSettings>;
  updateProject(
    projectId: string,
    input: UpdateProjectInput,
    actorUserId: string,
  ): Promise<Project>;
}

@Controller("api/projects")
export class ProjectsController {
  constructor(@Inject(ProjectService) private readonly projectService: ProjectsControllerStore) {}

  @Get()
  async listProjects(
    @Query("page") page: string | undefined,
    @Query("query") query: string | undefined,
    @Query("clientId") clientId: string | undefined,
    @Query("status") status: string | undefined,
  ): Promise<{ page: number; pageSize: number; projects: ProjectResponse[]; total: number }> {
    const projects = await this.projectService.listProjects({
      clientId,
      page: readOptionalPage(page),
      query,
      status: readOptionalListStatus(status),
    });

    return {
      page: projects.page,
      pageSize: projects.pageSize,
      projects: projects.projects.map(toProjectResponse),
      total: projects.total,
    };
  }

  @Post()
  async createProject(
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ project: ProjectResponse }> {
    try {
      return {
        project: toProjectResponse(
          await this.projectService.createProject(readCreateProjectInput(body), context.userId),
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Get("settings/code")
  async getCodeSettings(): Promise<{ settings: ProjectCodeSettingsResponse }> {
    try {
      return { settings: toCodeSettingsResponse(await this.projectService.getCodeSettings()) };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Put("settings/code")
  async updateCodeSettings(
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ settings: ProjectCodeSettingsResponse }> {
    try {
      return {
        settings: toCodeSettingsResponse(
          await this.projectService.updateCodeSettings(
            readUpdateCodeSettingsInput(body),
            context.userId,
          ),
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Get(":projectId")
  async getProject(@Param("projectId") projectId: string): Promise<{ project: ProjectResponse }> {
    try {
      return { project: toProjectResponse(await this.projectService.getProject(projectId)) };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Put(":projectId")
  async updateProject(
    @Param("projectId") projectId: string,
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ project: ProjectResponse }> {
    try {
      return {
        project: toProjectResponse(
          await this.projectService.updateProject(
            projectId,
            readUpdateProjectInput(body),
            context.userId,
          ),
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Delete(":projectId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProject(@Param("projectId") projectId: string): Promise<void> {
    try {
      await this.projectService.deleteProject(projectId);
    } catch (error) {
      throw toHttpException(error);
    }
  }
}

function readCreateProjectInput(body: unknown): CreateProjectInput {
  const record = readRecord(body);

  if (typeof record.clientId !== "string") {
    throw new BadRequestException("clientId is required.");
  }

  if (typeof record.name !== "string") {
    throw new BadRequestException("name is required.");
  }

  if (typeof record.startDate !== "string") {
    throw new BadRequestException("startDate is required.");
  }

  if (typeof record.committedEndDate !== "string") {
    throw new BadRequestException("committedEndDate is required.");
  }

  if (record.description !== undefined && record.description !== null && typeof record.description !== "string") {
    throw new BadRequestException("description must be a string or null when provided.");
  }

  return {
    clientId: record.clientId,
    committedEndDate: record.committedEndDate,
    description: record.description as string | null | undefined,
    name: record.name,
    startDate: record.startDate,
    status: readOptionalProjectStatus(record.status),
  };
}

function readUpdateProjectInput(body: unknown): UpdateProjectInput {
  const record = readRecord(body);
  const input: UpdateProjectInput = { version: readPositiveInteger(record.version, "version") };

  if (record.name !== undefined) {
    if (typeof record.name !== "string") {
      throw new BadRequestException("name must be a string when provided.");
    }

    input.name = record.name;
  }

  if (record.description !== undefined) {
    if (record.description !== null && typeof record.description !== "string") {
      throw new BadRequestException("description must be a string or null when provided.");
    }

    input.description = record.description;
  }

  if (record.startDate !== undefined) {
    if (typeof record.startDate !== "string") {
      throw new BadRequestException("startDate must be a string when provided.");
    }

    input.startDate = record.startDate;
  }

  if (record.committedEndDate !== undefined) {
    if (typeof record.committedEndDate !== "string") {
      throw new BadRequestException("committedEndDate must be a string when provided.");
    }

    input.committedEndDate = record.committedEndDate;
  }

  if (record.status !== undefined) {
    input.status = readRequiredStatus(record.status);
  }

  return input;
}

function readUpdateCodeSettingsInput(body: unknown): UpdateProjectCodeSettingsInput {
  const record = readRecord(body);

  if (typeof record.prefix !== "string") {
    throw new BadRequestException("prefix is required.");
  }

  return {
    codeLength: readPositiveInteger(record.codeLength, "codeLength"),
    nextSequence: readPositiveBigInt(record.nextSequence, "nextSequence"),
    prefix: record.prefix,
    version: readPositiveInteger(record.version, "version"),
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

function readOptionalProjectStatus(value: unknown): ProjectStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readRequiredStatus(value);
}

function readOptionalListStatus(value: unknown): ProjectStatusFilter | undefined {
  if (value === undefined || value === "all") {
    return value;
  }

  return readRequiredStatus(value);
}

function readRequiredStatus(value: unknown): ProjectStatus {
  if (
    value !== "planned" &&
    value !== "active" &&
    value !== "paused" &&
    value !== "finalized" &&
    value !== "cancelled"
  ) {
    throw new BadRequestException("status must be planned, active, paused, finalized, or cancelled.");
  }

  return value;
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("The request body must be an object.");
  }

  return value as Record<string, unknown>;
}

function readPositiveBigInt(value: unknown, field: string): bigint {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return BigInt(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value) && BigInt(value) > 0n) {
    return BigInt(value);
  }

  throw new BadRequestException(`${field} must be a positive integer.`);
}

function readPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }

  return value;
}

function toProjectResponse(project: Project): ProjectResponse {
  return {
    client: project.client,
    code: project.code,
    committedEndDate: project.committedEndDate,
    description: project.description,
    id: project.id,
    name: project.name,
    startDate: project.startDate,
    status: project.status,
    version: project.version,
  };
}

function toCodeSettingsResponse(settings: {
  codeLength: number;
  nextSequence: bigint;
  prefix: string;
  version: number;
}): ProjectCodeSettingsResponse {
  return {
    codeLength: settings.codeLength,
    nextSequence: settings.nextSequence.toString(),
    prefix: settings.prefix,
    version: settings.version,
  };
}

function toHttpException(error: unknown): Error {
  if (
    error instanceof ProjectNotFoundError ||
    error instanceof ProjectClientNotFoundError ||
    error instanceof ProjectCodeSettingsNotFoundError
  ) {
    return new NotFoundException(error.message);
  }

  if (
    error instanceof ProjectCodeExhaustedError ||
    error instanceof ProjectCodeSettingsVersionConflictError ||
    error instanceof ProjectRelatedRecordsError ||
    error instanceof ProjectVersionConflictError
  ) {
    return new ConflictException(error.message);
  }

  if (error instanceof ProjectClientInactiveError || error instanceof ProjectValidationError) {
    return new BadRequestException(error.message);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Project operation failed.");
}
