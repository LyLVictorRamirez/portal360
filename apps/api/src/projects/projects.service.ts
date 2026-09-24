import { Inject, Injectable } from "@nestjs/common";

import {
  type CreateProjectInput,
  type CreateProjectRecordInput,
  type CreateProjectStageInput,
  type CreateProjectStageRecordInput,
  type DeleteProjectStageInput,
  type DeleteProjectStageRecordInput,
  type ListProjectsInput,
  type ListProjectsQuery,
  type Project,
  type ProjectCodeSettings,
  type ProjectDetail,
  type ProjectList,
  type ProjectStage,
  type ProjectStageDirection,
  type ProjectStatus,
  projectStatuses,
  ProjectTerminalStatusError,
  ProjectStageValidationError,
  ProjectValidationError,
  type MoveProjectStageInput,
  type MoveProjectStageRecordInput,
  type UpdateProjectCodeSettingsInput,
  type UpdateProjectCodeSettingsRecordInput,
  type UpdateProjectInput,
  type UpdateProjectRecordInput,
  type UpdateProjectStageInput,
  type UpdateProjectStageRecordInput,
} from "./projects.contracts.js";
import { ProjectRepository } from "./projects.repository.js";

const projectListPageSize = 25;

export interface ProjectStore {
  createProject(input: CreateProjectRecordInput): Promise<Project>;
  createProjectStage(
    projectId: string,
    input: CreateProjectStageRecordInput,
  ): Promise<ProjectStage>;
  deleteProject(projectId: string): Promise<void>;
  deleteProjectStage(
    projectId: string,
    stageId: string,
    input: DeleteProjectStageRecordInput,
  ): Promise<void>;
  getCodeSettings(): Promise<ProjectCodeSettings>;
  getProject(projectId: string): Promise<Project | ProjectDetail>;
  listProjects(query: ListProjectsQuery): Promise<ProjectList>;
  moveProjectStage(
    projectId: string,
    stageId: string,
    input: MoveProjectStageRecordInput,
  ): Promise<ProjectStage>;
  updateCodeSettings(input: UpdateProjectCodeSettingsRecordInput): Promise<ProjectCodeSettings>;
  updateProject(projectId: string, input: UpdateProjectRecordInput): Promise<Project>;
  updateProjectStage(
    projectId: string,
    stageId: string,
    input: UpdateProjectStageRecordInput,
  ): Promise<ProjectStage>;
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

  async getProject(projectId: string): Promise<ProjectDetail> {
    const project = await this.projectRepository.getProject(normalizeProjectId(projectId));

    return {
      ...project,
      stages: "stages" in project ? project.stages : [],
    };
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
    const normalizedProjectId = normalizeProjectId(projectId);
    const currentProject = await this.projectRepository.getProject(normalizedProjectId);

    if (currentProject.status === "finalized" || currentProject.status === "cancelled") {
      throw new ProjectTerminalStatusError("A finalized or cancelled Project cannot be changed.");
    }

    return this.projectRepository.updateProject(normalizedProjectId, {
      ...normalizeProjectUpdate(input),
      actorUserId: normalizeActorUserId(actorUserId),
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.projectRepository.deleteProject(normalizeProjectId(projectId));
  }

  async createProjectStage(
    projectId: string,
    input: CreateProjectStageInput,
    actorUserId: string,
  ): Promise<ProjectStage> {
    const normalizedProjectId = normalizeProjectId(projectId);
    await assertProjectAllowsStageChanges(this.projectRepository, normalizedProjectId);

    return this.projectRepository.createProjectStage(normalizedProjectId, {
      ...normalizeProjectStageCreation(input),
      actorUserId: normalizeActorUserId(actorUserId),
    });
  }

  async updateProjectStage(
    projectId: string,
    stageId: string,
    input: UpdateProjectStageInput,
    actorUserId: string,
  ): Promise<ProjectStage> {
    const normalizedProjectId = normalizeProjectId(projectId);
    await assertProjectAllowsStageChanges(this.projectRepository, normalizedProjectId);

    return this.projectRepository.updateProjectStage(
      normalizedProjectId,
      normalizeProjectStageId(stageId),
      {
        ...normalizeProjectStageUpdate(input),
        actorUserId: normalizeActorUserId(actorUserId),
      },
    );
  }

  async moveProjectStage(
    projectId: string,
    stageId: string,
    input: MoveProjectStageInput,
    actorUserId: string,
  ): Promise<ProjectStage> {
    const normalizedProjectId = normalizeProjectId(projectId);
    await assertProjectAllowsStageChanges(this.projectRepository, normalizedProjectId);

    return this.projectRepository.moveProjectStage(
      normalizedProjectId,
      normalizeProjectStageId(stageId),
      {
        ...normalizeProjectStageMove(input),
        actorUserId: normalizeActorUserId(actorUserId),
      },
    );
  }

  async deleteProjectStage(
    projectId: string,
    stageId: string,
    input: DeleteProjectStageInput,
    actorUserId: string,
  ): Promise<void> {
    const normalizedProjectId = normalizeProjectId(projectId);
    await assertProjectAllowsStageChanges(this.projectRepository, normalizedProjectId);

    await this.projectRepository.deleteProjectStage(
      normalizedProjectId,
      normalizeProjectStageId(stageId),
      {
        ...normalizeProjectStageDeletion(input),
        actorUserId: normalizeActorUserId(actorUserId),
      },
    );
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
  const committedEndDate = normalizeDate(value.committedEndDate, "Project committed end date");
  validateDateOrder(startDate, committedEndDate);

  return {
    clientId: normalizeProjectClientId(value.clientId),
    committedEndDate,
    description: normalizeDescription(value.description),
    name: normalizeProjectName(value.name),
    startDate,
    status: value.status === undefined ? "new" : normalizeProjectStatus(value.status),
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
  const description =
    value.description === undefined ? undefined : normalizeDescription(value.description);
  const startDate =
    value.startDate === undefined
      ? undefined
      : normalizeDate(value.startDate, "Project start date");
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

function normalizeProjectStageCreation(value: CreateProjectStageInput): CreateProjectStageInput {
  if (typeof value !== "object" || value === null) {
    throw new ProjectStageValidationError("Project Stage creation must be an object.");
  }

  return { name: normalizeProjectStageName(value.name) };
}

function normalizeProjectStageUpdate(value: UpdateProjectStageInput): UpdateProjectStageInput {
  if (typeof value !== "object" || value === null) {
    throw new ProjectStageValidationError("Project Stage update must be an object.");
  }

  return {
    name: normalizeProjectStageName(value.name),
    version: normalizeProjectStageVersion(value.version),
  };
}

function normalizeProjectStageMove(value: MoveProjectStageInput): MoveProjectStageInput {
  if (typeof value !== "object" || value === null) {
    throw new ProjectStageValidationError("Project Stage move must be an object.");
  }

  return {
    direction: normalizeProjectStageDirection(value.direction),
    version: normalizeProjectStageVersion(value.version),
  };
}

function normalizeProjectStageDeletion(value: DeleteProjectStageInput): DeleteProjectStageInput {
  if (typeof value !== "object" || value === null) {
    throw new ProjectStageValidationError("Project Stage deletion must be an object.");
  }

  return { version: normalizeProjectStageVersion(value.version) };
}

function normalizeProjectStageId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProjectStageValidationError("Project Stage id must be a non-empty string.");
  }

  return value;
}

function normalizeProjectStageName(value: unknown): string {
  if (typeof value !== "string") {
    throw new ProjectStageValidationError("Project Stage name must be a string.");
  }

  const name = value.trim();

  if (name.length < 1 || name.length > 15) {
    throw new ProjectStageValidationError(
      "Project Stage name must contain between 1 and 15 characters.",
    );
  }

  return name;
}

function normalizeProjectStageVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new ProjectStageValidationError("Project Stage version must be a positive integer.");
  }

  return value;
}

function normalizeProjectStageDirection(value: unknown): ProjectStageDirection {
  if (value !== "up" && value !== "down") {
    throw new ProjectStageValidationError("Project Stage direction must be up or down.");
  }

  return value;
}

async function assertProjectAllowsStageChanges(
  repository: Pick<ProjectStore, "getProject">,
  projectId: string,
): Promise<void> {
  const project = await repository.getProject(projectId);

  if (project.status === "finalized" || project.status === "cancelled") {
    throw new ProjectTerminalStatusError(
      "Project Stages cannot be changed when their Project is finalized or cancelled.",
    );
  }
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
    throw new ProjectValidationError(
      "Project status must be new, in_execution, paused, finalized, or cancelled.",
    );
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
