export const requirementStatuses = [
  "new",
  "in_analysis",
  "quoted",
  "approved",
  "in_execution",
  "closed",
  "cancelled",
] as const;

export type RequirementStatus = (typeof requirementStatuses)[number];
export type RequirementStatusFilter = "all" | RequirementStatus;

export interface RequirementClientReference {
  code: string;
  id: string;
  name: string;
}

export interface Requirement {
  approvedByUserId: string | null;
  approvedByUserName: string | null;
  approvedOn: string | null;
  client: RequirementClientReference;
  code: string;
  committedOn: string | null;
  createdAt: Date;
  createdByUserId: string;
  description: string | null;
  id: string;
  name: string;
  quotedOn: string | null;
  requestedOn: string;
  status: RequirementStatus;
  updatedAt: Date;
  updatedByUserId: string;
  version: number;
}

export interface RequirementCodeSettings {
  codeLength: number;
  createdAt: Date;
  createdByUserId: string | null;
  nextSequence: bigint;
  prefix: string;
  updatedAt: Date;
  updatedByUserId: string | null;
  version: number;
}

export interface RequirementList {
  page: number;
  pageSize: number;
  requirements: Requirement[];
  total: number;
}

export interface CreateRequirementInput {
  clientId: string;
  committedOn?: string | null;
  description?: string | null;
  name: string;
  requestedOn: string;
}

export interface CreateRequirementRecordInput extends CreateRequirementInput {
  actorUserId: string;
  committedOn: string | null;
  description: string | null;
  status: "new";
}

export interface UpdateRequirementInput {
  approvedOn?: string | null;
  committedOn?: string | null;
  description?: string | null;
  name?: string;
  quotedOn?: string | null;
  requestedOn?: string;
  status?: RequirementStatus;
  version: number;
}

export interface UpdateRequirementRecordInput extends UpdateRequirementInput {
  actorUserId: string;
  approvedByUserId?: string;
}

export interface UpdateRequirementCodeSettingsInput {
  codeLength: number;
  nextSequence: bigint;
  prefix: string;
  version: number;
}

export interface UpdateRequirementCodeSettingsRecordInput extends UpdateRequirementCodeSettingsInput {
  actorUserId: string;
}

export interface ListRequirementsInput {
  clientId?: string;
  page?: number;
  query?: string;
  status?: RequirementStatusFilter;
}

export interface ListRequirementsQuery {
  clientId: string | null;
  page: number;
  pageSize: number;
  query: string | null;
  status: RequirementStatus | null;
}

export class RequirementCodeExhaustedError extends Error {}

export class RequirementCodeSettingsNotFoundError extends Error {}

export class RequirementCodeSettingsVersionConflictError extends Error {}

export class RequirementClientInactiveError extends Error {}

export class RequirementClientNotFoundError extends Error {}

export class RequirementNotFoundError extends Error {}

export class RequirementRelatedRecordsError extends Error {}

export class RequirementValidationError extends Error {}

export class RequirementVersionConflictError extends Error {}
