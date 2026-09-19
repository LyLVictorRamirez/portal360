export const projectStatuses = ["planned", "active", "paused", "finalized", "cancelled"] as const;

export type ProjectStatus = (typeof projectStatuses)[number];
export type ProjectStatusFilter = "all" | ProjectStatus;

export interface ProjectClientReference {
  code: string;
  id: string;
  name: string;
}

export interface Project {
  client: ProjectClientReference;
  code: string;
  committedEndDate: string;
  createdAt: Date;
  createdByUserId: string;
  description: string | null;
  id: string;
  name: string;
  startDate: string;
  status: ProjectStatus;
  updatedAt: Date;
  updatedByUserId: string;
  version: number;
}

export interface ProjectCodeSettings {
  codeLength: number;
  createdAt: Date;
  createdByUserId: string | null;
  nextSequence: bigint;
  prefix: string;
  updatedAt: Date;
  updatedByUserId: string | null;
  version: number;
}

export interface ProjectList {
  page: number;
  pageSize: number;
  projects: Project[];
  total: number;
}

export interface CreateProjectInput {
  clientId: string;
  committedEndDate: string;
  description?: string | null;
  name: string;
  startDate: string;
  status?: ProjectStatus;
}

export interface CreateProjectRecordInput extends CreateProjectInput {
  actorUserId: string;
  status: ProjectStatus;
}

export interface UpdateProjectInput {
  committedEndDate?: string;
  description?: string | null;
  name?: string;
  startDate?: string;
  status?: ProjectStatus;
  version: number;
}

export interface UpdateProjectRecordInput extends UpdateProjectInput {
  actorUserId: string;
}

export interface UpdateProjectCodeSettingsInput {
  codeLength: number;
  nextSequence: bigint;
  prefix: string;
  version: number;
}

export interface UpdateProjectCodeSettingsRecordInput
  extends UpdateProjectCodeSettingsInput {
  actorUserId: string;
}

export interface ListProjectsInput {
  clientId?: string;
  page?: number;
  query?: string;
  status?: ProjectStatusFilter;
}

export interface ListProjectsQuery {
  clientId: string | null;
  page: number;
  pageSize: number;
  query: string | null;
  status: ProjectStatus | null;
}

export class ProjectCodeExhaustedError extends Error {}

export class ProjectCodeSettingsNotFoundError extends Error {}

export class ProjectCodeSettingsVersionConflictError extends Error {}

export class ProjectClientInactiveError extends Error {}

export class ProjectClientNotFoundError extends Error {}

export class ProjectNotFoundError extends Error {}

export class ProjectRelatedRecordsError extends Error {}

export class ProjectValidationError extends Error {}

export class ProjectVersionConflictError extends Error {}
