export const activityStatuses = [
  "pending",
  "in_progress",
  "in_review",
  "customer_testing",
  "blocked",
  "waiting_third_party",
  "finalized",
] as const;
export type { ActivityDescription } from "./activity-description.js";
import type { ActivityDescription } from "./activity-description.js";
export type ActivityStatus = (typeof activityStatuses)[number];

export const activityPriorities = ["critical", "high", "medium", "low"] as const;
export type ActivityPriority = (typeof activityPriorities)[number];

export const activityWaitingForValues = ["client", "provider", "other"] as const;
export type ActivityWaitingFor = (typeof activityWaitingForValues)[number];

export const activityContainerTypes = ["project", "requirement", "ticket"] as const;
export type ActivityContainerType = (typeof activityContainerTypes)[number];
export const activityRelocatePlacements = ["before", "after", "inside", "last"] as const;
export type ActivityRelocatePlacement = (typeof activityRelocatePlacements)[number];

export interface Activity {
  activityCategoryId: string;
  assignedUserId: string;
  assignedUserName: string;
  blockedReason: string | null;
  blockedStartedAt: Date | null;
  clientName: string;
  containerId: string;
  containerName: string;
  containerType: ActivityContainerType;
  createdAt: Date;
  createdByUserId: string;
  customerCommitmentDate: string | null;
  description: ActivityDescription | null;
  estimatedHours: number;
  id: string;
  isCustomerDeliverable: boolean;
  name: string;
  parentActivityId: string | null;
  position: number;
  priority: ActivityPriority;
  projectStageId: string | null;
  projectStageName: string | null;
  status: ActivityStatus;
  targetDate: string | null;
  updatedAt: Date;
  updatedByUserId: string;
  version: number;
  waitingFor: ActivityWaitingFor | null;
  waitingReason: string | null;
  waitingStartedAt: Date | null;
}

export interface ActivityTreeItem extends Activity {
  matchesFilter: boolean;
}

export interface ActivityTree {
  activities: ActivityTreeItem[];
}

export interface ActivityDependency {
  id: string;
  name: string;
  status: ActivityStatus;
  version: number;
}

export interface ActivityDependencies {
  predecessors: ActivityDependency[];
  successors: ActivityDependency[];
}

export interface ActivityDetail extends Activity {
  dependencies: ActivityDependencies;
}

export interface CreateActivityInput {
  activityCategoryId: string;
  assignedUserId: string;
  blockedReason?: string;
  containerId: string;
  containerType: ActivityContainerType;
  customerCommitmentDate?: string | null;
  description?: ActivityDescription | null;
  estimatedHours: number;
  isCustomerDeliverable?: boolean;
  name: string;
  parentActivityId?: string | null;
  priority?: ActivityPriority;
  projectStageId?: string;
  status?: ActivityStatus;
  targetDate?: string | null;
  waitingFor?: ActivityWaitingFor;
  waitingReason?: string;
}

export interface CreateActivityRecordInput extends CreateActivityInput {
  actorUserId: string;
}

export interface UpdateActivityInput {
  activityCategoryId?: string;
  assignedUserId?: string;
  blockedReason?: string | null;
  customerCommitmentDate?: string | null;
  description?: ActivityDescription | null;
  estimatedHours?: number;
  isCustomerDeliverable?: boolean;
  name?: string;
  parentActivityId?: string | null;
  priority?: ActivityPriority;
  projectStageId?: string;
  status?: ActivityStatus;
  targetDate?: string | null;
  version: number;
  waitingFor?: ActivityWaitingFor | null;
  waitingReason?: string | null;
}

export interface UpdateActivityRecordInput extends UpdateActivityInput {
  actorUserId: string;
  blockedStartedAt?: Date | null;
  waitingStartedAt?: Date | null;
}

export interface RelocateActivityInput {
  placement: ActivityRelocatePlacement;
  targetActivityId: string | null;
  version: number;
}

export interface RelocateActivityRecordInput extends RelocateActivityInput {
  actorUserId: string;
}

export interface DeleteActivityInput {
  version: number;
}

export interface CreateActivityDependencyInput {
  predecessorActivityId: string;
  version: number;
}

export interface CreateActivityDependencyRecordInput extends CreateActivityDependencyInput {
  actorUserId: string;
}

export interface DeleteActivityDependencyInput {
  version: number;
}

export interface DeleteActivityDependencyRecordInput extends DeleteActivityDependencyInput {
  actorUserId: string;
}

export interface ListActivitiesInput {
  activityCategoryId?: string;
  assignedUserId?: string;
  clientId?: string;
  containerId?: string;
  containerType?: ActivityContainerType;
  page?: number;
  projectStageId?: string;
  priority?: ActivityPriority;
  query?: string;
  status?: ActivityStatus;
}

export interface ListActivitiesQuery {
  activityCategoryId: string | null;
  assignedUserId: string | null;
  clientId: string | null;
  containerId: string | null;
  containerType: ActivityContainerType | null;
  page: number;
  pageSize: number;
  projectStageId: string | null;
  priority: ActivityPriority | null;
  query: string | null;
  status: ActivityStatus | null;
}

export interface ListActivityTreeInput {
  activityCategoryId?: string;
  assignedUserId?: string;
  clientId?: string;
  containerId?: string;
  containerType?: ActivityContainerType;
  projectStageId?: string;
  priority?: ActivityPriority;
  query?: string;
  status?: ActivityStatus;
}

export interface ListActivityTreeQuery {
  activityCategoryId: string | null;
  assignedUserId: string | null;
  clientId: string | null;
  containerId: string | null;
  containerType: ActivityContainerType | null;
  projectStageId: string | null;
  priority: ActivityPriority | null;
  query: string | null;
  status: ActivityStatus | null;
}

export interface ActivityList {
  activities: Activity[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ActivityAuditEvent {
  action: "create" | "modify" | "delete";
  actorUserId: string;
  actorUserName: string;
  changes: Record<string, { after: unknown; before: unknown }>;
  id: string;
  occurredAt: Date;
  reason: string | null;
}

export interface ActivityAssignee {
  email: string;
  id: string;
  name: string;
}

export class ActivityCategoryInactiveError extends Error {}
export class ActivityContainerNotFoundError extends Error {}
export class ActivityContainerTerminalError extends Error {}
export class ActivityDependencyValidationError extends Error {}
export class ActivityNotFoundError extends Error {}
export class ActivityOrderError extends Error {}
export class ActivityTreeLimitError extends Error {}
export class ActivityRelatedRecordsError extends Error {
  constructor(
    message: string,
    public readonly relatedActivityNames: readonly string[] = [],
  ) {
    super(message);
  }
}
export class ActivityValidationError extends Error {}
export class ActivityVersionConflictError extends Error {}
export class ActivityAssigneeInvalidError extends Error {}
