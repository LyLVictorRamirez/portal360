import { Inject, Injectable } from "@nestjs/common";

import {
  type CreateProjectInput,
  type CreateProjectRecordInput,
  type ListProjectsInput,
  type ListProjectsQuery,
  type Project,
  type ProjectCodeSettings,
  type ProjectList,
  type ProjectStatus,
  projectStatuses,
  ProjectValidationError,
  type UpdateProjectCodeSettingsInput,
  type UpdateProjectCodeSettingsRecordInput,
  type UpdateProjectInput,
  type UpdateProjectRecordInput,
} from "./projects.contracts.js";
import { ProjectRepository } from "./projects.repository.js";

const projectListPageSize = 25;

export interface ProjectStore {
  createProject(input: CreateProjectRecordInput): Promise<Project>;
  deleteProject(projectId: string): Promise<void>;
  getCodeSettings(): Promise<ProjectCodeSettings>;
  getProject(projectId: string): Promise<Project>;
  listProjects(query: ListProjectsQuery): Promise<ProjectList>;
  updateCodeSettings(input: UpdateProjectCodeSettingsRecordInput): Promise<ProjectCodeSettings>;
  updateProject(projectId: string, input: UpdateProjectRecordInput): Promise<Project>;
}

@Injectable()
export class ProjectService {
  constructor(@Inject(ProjectRepository) private readonly projectRepository: ProjectStore) {}

  async getCodeSettings(): Promise<ProjectCodeSettings> {
    return this.projectRepository.getCodeSettings();
  }

  async createProject(input: CreateProjectInput, actorUserId: string): Promise<Project> {
    return this.projectRepository.createProject({
      ...normalizeProjectCreation(input),
      actorUserId: normalizeActorUserId(actorUserId),
    });
  }

  async getProject(projectId: string): Promise<Project> {
    return this.projectRepository.getProject(normalizeProjectId(projectId));
  }

  async listProjects(input: ListProjectsInput = {}): Promise<ProjectList> {
    const page = input.page ?? 1;

    if (!Number.isSafeInteger(page) || page < 1) {
      throw new ProjectValidationError("Project list page must be a positive integer.");
    }

    const status = input.status ?? "all";

    return this.projectRepository.listProjects({
      clientId: input.clientId === undefined ? null : normalizeProjectClientId(input.clientId),
      page,
      pageSize: projectListPageSize,
      query: normalizeSearchQuery(input.query),
      status: status === "all" ? null : normalizeProjectStatus(status),
    });
  }

  async updateProject(
    projectId: string,
    input: UpdateProjectInput,
    actorUserId: string,
  ): Promise<Project> {
    return this.projectRepository.updateProject(normalizeProjectId(projectId), {
      ...normalizeProjectUpdate(input),
      actorUserId: normalizeActorUserId(actorUserId),
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.projectRepository.deleteProject(normalizeProjectId(projectId));
  }

  async updateCodeSettings(
    input: UpdateProjectCodeSettingsInput,
    actorUserId: string,
  ): Promise<ProjectCodeSettings> {
    return this.projectRepository.updateCodeSettings({
      ...normalizeCodeSettingsUpdate(input),
      actorUserId: normalizeActorUserId(actorUserId),
    });
  }
}

function normalizeProjectCreation(
  value: CreateProjectInput,
): Omit<CreateProjectRecordInput, "actorUserId"> {
  if (typeof value !== "object" || value === null) {
    throw new ProjectValidationError("Project creation must be an object.");
  }

  const startDate = normalizeDate(value.startDate, "Project start date");
  const committedEndDate = normalizeDate(
    value.committedEndDate,
    "Project committed end date",
  );
  validateDateOrder(startDate, committedEndDate);

  return {
    clientId: normalizeProjectClientId(value.clientId),
    committedEndDate,
    description: normalizeDescription(value.description),
    name: normalizeProjectName(value.name),
    startDate,
    status: value.status === undefined ? "planned" : normalizeProjectStatus(value.status),
  };
}

function normalizeProjectUpdate(value: UpdateProjectInput): UpdateProjectInput {
  if (typeof value !== "object" || value === null) {
    throw new ProjectValidationError("Project update must be an object.");
  }

  if (!Number.isSafeInteger(value.version) || value.version < 1) {
    throw new ProjectValidationError("Project version must be a positive integer.");
  }

  const name = value.name === undefined ? undefined : normalizeProjectName(value.name);
  const description = value.description === undefined ? undefined : normalizeDescription(value.description);
  const startDate =
    value.startDate === undefined ? undefined : normalizeDate(value.startDate, "Project start date");
  const committedEndDate =
    value.committedEndDate === undefined
      ? undefined
      : normalizeDate(value.committedEndDate, "Project committed end date");
  const status = value.status === undefined ? undefined : normalizeProjectStatus(value.status);

  if (startDate !== undefined && committedEndDate !== undefined) {
    validateDateOrder(startDate, committedEndDate);
  }

  if (
    name === undefined &&
    description === undefined &&
    startDate === undefined &&
    committedEndDate === undefined &&
    status === undefined
  ) {
    throw new ProjectValidationError(
      "A Project update must change its name, description, dates, or status.",
    );
  }

  const update: UpdateProjectInput = { version: value.version };

  if (name !== undefined) {
    update.name = name;
  }

  if (value.description !== undefined) {
    update.description = description;
  }

  if (startDate !== undefined) {
    update.startDate = startDate;
  }

  if (committedEndDate !== undefined) {
    update.committedEndDate = committedEndDate;
  }

  if (status !== undefined) {
    update.status = status;
  }

  return update;
}

function normalizeCodeSettingsUpdate(
  value: UpdateProjectCodeSettingsInput,
): UpdateProjectCodeSettingsInput {
  if (typeof value !== "object" || value === null) {
    throw new ProjectValidationError("Project code settings update must be an object.");
  }

  if (typeof value.prefix !== "string" || !/^[A-Z0-9]{1,10}$/.test(value.prefix)) {
    throw new ProjectValidationError(
      "Project code prefix must contain 1 to 10 uppercase letters or numbers.",
    );
  }

  if (
    !Number.isSafeInteger(value.codeLength) ||
    value.codeLength < 3 ||
    value.codeLength > 20 ||
    value.prefix.length >= value.codeLength
  ) {
    throw new ProjectValidationError(
      "Project code length must be between 3 and 20 and leave room for its sequence.",
    );
  }

  if (typeof value.nextSequence !== "bigint" || value.nextSequence < 1n) {
    throw new ProjectValidationError("Project next sequence must be a positive integer.");
  }

  if (value.nextSequence.toString().length > value.codeLength - value.prefix.length) {
    throw new ProjectValidationError(
      "Project next sequence does not fit the configured code length.",
    );
  }

  if (!Number.isSafeInteger(value.version) || value.version < 1) {
    throw new ProjectValidationError("Project code settings version must be a positive integer.");
  }

  return value;
}

function normalizeActorUserId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProjectValidationError("A Project change must identify its authenticated actor.");
  }

  return value;
}

function normalizeProjectClientId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProjectValidationError("Project Client id must be a non-empty string.");
  }

  return value;
}

function normalizeProjectId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProjectValidationError("Project id must be a non-empty string.");
  }

  return value;
}

function normalizeProjectName(value: unknown): string {
  if (typeof value !== "string") {
    throw new ProjectValidationError("Project name must be a string.");
  }

  const name = value.trim();

  if (name.length < 1 || name.length > 200) {
    throw new ProjectValidationError("Project name must contain between 1 and 200 characters.");
  }

  return name;
}

function normalizeDescription(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string" || value.length > 2000) {
    throw new ProjectValidationError("Project description must contain at most 2000 characters.");
  }

  return value;
}

function normalizeDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ProjectValidationError(`${field} must use the YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ProjectValidationError(`${field} must be a valid calendar date.`);
  }

  return value;
}

function normalizeProjectStatus(value: unknown): ProjectStatus {
  if (!(projectStatuses as readonly string[]).includes(value as string)) {
    throw new ProjectValidationError("Project status must be planned, active, paused, finalized, or cancelled.");
  }

  return value as ProjectStatus;
}

function normalizeSearchQuery(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ProjectValidationError("Project search query must be a string.");
  }

  return value.trim() || null;
}

function validateDateOrder(startDate: string, committedEndDate: string): void {
  if (committedEndDate < startDate) {
    throw new ProjectValidationError(
      "Project committed end date must be the same as or later than its start date.",
    );
  }
}
