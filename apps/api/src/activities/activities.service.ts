import { Inject, Injectable } from "@nestjs/common";

import {
  type Activity,
  type ActivityAssignee,
  type ActivityAuditEvent,
  type ActivityContainerType,
  type ActivityDependencies,
  type ActivityDirection,
  type ActivityList,
  type ActivityPriority,
  type ActivityStatus,
  type ActivityWaitingFor,
  activityContainerTypes,
  activityPriorities,
  activityStatuses,
  activityWaitingForValues,
  type CreateActivityInput,
  type CreateActivityDependencyInput,
  type CreateActivityDependencyRecordInput,
  type CreateActivityRecordInput,
  type DeleteActivityDependencyInput,
  type DeleteActivityDependencyRecordInput,
  type DeleteActivityInput,
  type ListActivitiesInput,
  type ListActivitiesQuery,
  type MoveActivityInput,
  type UpdateActivityInput,
  type UpdateActivityRecordInput,
  ActivityValidationError,
} from "./activities.contracts.js";
import { normalizeActivityDescription } from "./activity-description.js";
import { ActivityRepository } from "./activities.repository.js";

const activityListPageSize = 25;

export interface ActivityStore {
  createActivity(input: CreateActivityRecordInput): Promise<Activity>;
  createActivityDependency(
    successorActivityId: string,
    input: CreateActivityDependencyRecordInput,
  ): Promise<ActivityDependencies>;
  deleteActivity(
    activityId: string,
    input: DeleteActivityInput & { actorUserId: string },
  ): Promise<void>;
  deleteActivityDependency(
    successorActivityId: string,
    predecessorActivityId: string,
    input: DeleteActivityDependencyRecordInput,
  ): Promise<ActivityDependencies>;
  getActivity(activityId: string): Promise<Activity>;
  listActivityDependencies(activityId: string): Promise<ActivityDependencies>;
  listAuditEvents(activityId: string): Promise<ActivityAuditEvent[]>;
  listAssignees(query: string): Promise<ActivityAssignee[]>;
  listActivities(query: ListActivitiesQuery): Promise<ActivityList>;
  moveActivity(
    activityId: string,
    input: MoveActivityInput & { actorUserId: string },
  ): Promise<Activity>;
  updateActivity(activityId: string, input: UpdateActivityRecordInput): Promise<Activity>;
}

@Injectable()
export class ActivityService {
  constructor(@Inject(ActivityRepository) private readonly activityRepository: ActivityStore) {}

  async createActivity(input: CreateActivityInput, actorUserId: string): Promise<Activity> {
    const normalized = normalizeCreate(input);
    return this.activityRepository.createActivity({
      ...normalized,
      actorUserId: normalizeActorUserId(actorUserId),
    });
  }

  async createActivityDependency(
    successorActivityId: string,
    input: CreateActivityDependencyInput,
    actorUserId: string,
  ): Promise<ActivityDependencies> {
    if (!input || typeof input !== "object") {
      throw new ActivityValidationError("Activity dependency creation must be an object.");
    }
    return this.activityRepository.createActivityDependency(
      normalizeActivityId(successorActivityId),
      {
        actorUserId: normalizeActorUserId(actorUserId),
        predecessorActivityId: normalizeActivityId(input.predecessorActivityId),
        version: normalizeVersion(input.version),
      },
    );
  }

  async deleteActivity(
    activityId: string,
    input: DeleteActivityInput,
    actorUserId: string,
  ): Promise<void> {
    await this.activityRepository.deleteActivity(normalizeActivityId(activityId), {
      actorUserId: normalizeActorUserId(actorUserId),
      version: normalizeVersion(input?.version),
    });
  }

  async deleteActivityDependency(
    successorActivityId: string,
    predecessorActivityId: string,
    input: DeleteActivityDependencyInput,
    actorUserId: string,
  ): Promise<ActivityDependencies> {
    return this.activityRepository.deleteActivityDependency(
      normalizeActivityId(successorActivityId),
      normalizeActivityId(predecessorActivityId),
      {
        actorUserId: normalizeActorUserId(actorUserId),
        version: normalizeVersion(input?.version),
      },
    );
  }

  async getActivity(activityId: string): Promise<Activity> {
    return this.activityRepository.getActivity(normalizeActivityId(activityId));
  }

  async listActivityDependencies(activityId: string): Promise<ActivityDependencies> {
    return this.activityRepository.listActivityDependencies(normalizeActivityId(activityId));
  }

  async listAuditEvents(activityId: string): Promise<ActivityAuditEvent[]> {
    return this.activityRepository.listAuditEvents(normalizeActivityId(activityId));
  }

  async listAssignees(query: string | undefined): Promise<ActivityAssignee[]> {
    return this.activityRepository.listAssignees(normalizeSearch(query) ?? "");
  }

  async listActivities(input: ListActivitiesInput = {}): Promise<ActivityList> {
    const page = input.page ?? 1;
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new ActivityValidationError("Activity list page must be a positive integer.");
    }

    return this.activityRepository.listActivities({
      activityCategoryId: optionalId(input.activityCategoryId, "Activity category id"),
      assignedUserId: optionalId(input.assignedUserId, "Activity assignee id"),
      clientId: optionalId(input.clientId, "Activity Client id"),
      containerId: optionalId(input.containerId, "Activity container id"),
      containerType:
        input.containerType === undefined ? null : normalizeContainerType(input.containerType),
      page,
      pageSize: activityListPageSize,
      priority: input.priority === undefined ? null : normalizePriority(input.priority),
      query: normalizeSearch(input.query),
      status: input.status === undefined ? null : normalizeStatus(input.status),
    });
  }

  async moveActivity(
    activityId: string,
    input: MoveActivityInput,
    actorUserId: string,
  ): Promise<Activity> {
    if (input?.direction !== "up" && input?.direction !== "down") {
      throw new ActivityValidationError("Activity move direction must be up or down.");
    }

    return this.activityRepository.moveActivity(normalizeActivityId(activityId), {
      actorUserId: normalizeActorUserId(actorUserId),
      direction: input.direction as ActivityDirection,
      version: normalizeVersion(input.version),
    });
  }

  async updateActivity(
    activityId: string,
    input: UpdateActivityInput,
    actorUserId: string,
  ): Promise<Activity> {
    const current = await this.activityRepository.getActivity(normalizeActivityId(activityId));
    const normalized = normalizeUpdate(input, current);

    return this.activityRepository.updateActivity(current.id, {
      ...normalized,
      actorUserId: normalizeActorUserId(actorUserId),
    });
  }
}

function normalizeCreate(
  value: CreateActivityInput,
): Omit<CreateActivityRecordInput, "actorUserId"> {
  if (!value || typeof value !== "object") {
    throw new ActivityValidationError("Activity creation must be an object.");
  }

  const status = value.status === undefined ? "pending" : normalizeStatus(value.status);
  const isCustomerDeliverable = value.isCustomerDeliverable ?? false;

  return {
    activityCategoryId: normalizeRequiredId(value.activityCategoryId, "Activity category id"),
    assignedUserId: normalizeRequiredId(value.assignedUserId, "Activity assignee id"),
    blockedReason:
      normalizeStateReason(value.blockedReason, status === "blocked", "Blocked reason") ??
      undefined,
    containerId: normalizeRequiredId(value.containerId, "Activity container id"),
    containerType: normalizeContainerType(value.containerType),
    customerCommitmentDate: normalizeConditionalDate(
      value.customerCommitmentDate,
      isCustomerDeliverable,
      "Customer commitment date",
    ),
    description: normalizeDescription(value.description),
    estimatedHours: normalizeEstimatedHours(value.estimatedHours),
    isCustomerDeliverable,
    name: normalizeName(value.name),
    parentActivityId: optionalId(value.parentActivityId, "Activity parent id"),
    priority: value.priority === undefined ? "medium" : normalizePriority(value.priority),
    projectStageId: optionalId(value.projectStageId, "Project Stage id") ?? undefined,
    status,
    targetDate: normalizeOptionalDate(value.targetDate, "Activity target date"),
    waitingFor:
      normalizeWaitingFor(value.waitingFor, status === "waiting_third_party") ?? undefined,
    waitingReason:
      normalizeStateReason(
        value.waitingReason,
        status === "waiting_third_party",
        "Waiting reason",
      ) ?? undefined,
  };
}

function normalizeUpdate(
  value: UpdateActivityInput,
  current: Activity,
): Omit<UpdateActivityRecordInput, "actorUserId"> {
  if (!value || typeof value !== "object") {
    throw new ActivityValidationError("Activity update must be an object.");
  }

  const version = normalizeVersion(value.version);
  const status = value.status === undefined ? current.status : normalizeStatus(value.status);
  const isCustomerDeliverable = value.isCustomerDeliverable ?? current.isCustomerDeliverable;
  const update: Omit<UpdateActivityRecordInput, "actorUserId"> = { version };

  if (value.activityCategoryId !== undefined)
    update.activityCategoryId = normalizeRequiredId(
      value.activityCategoryId,
      "Activity category id",
    );
  if (value.assignedUserId !== undefined)
    update.assignedUserId = normalizeRequiredId(value.assignedUserId, "Activity assignee id");
  if (value.description !== undefined) update.description = normalizeDescription(value.description);
  if (value.estimatedHours !== undefined)
    update.estimatedHours = normalizeEstimatedHours(value.estimatedHours);
  if (value.isCustomerDeliverable !== undefined)
    update.isCustomerDeliverable = isCustomerDeliverable;
  if (value.name !== undefined) update.name = normalizeName(value.name);
  if (value.parentActivityId !== undefined)
    update.parentActivityId = optionalId(value.parentActivityId, "Activity parent id");
  if (value.priority !== undefined) update.priority = normalizePriority(value.priority);
  if (value.projectStageId !== undefined)
    update.projectStageId = normalizeRequiredId(value.projectStageId, "Project Stage id");
  if (value.status !== undefined) update.status = status;
  if (value.targetDate !== undefined)
    update.targetDate = normalizeOptionalDate(value.targetDate, "Activity target date");

  if (value.customerCommitmentDate !== undefined || value.isCustomerDeliverable !== undefined) {
    update.customerCommitmentDate = normalizeConditionalDate(
      value.customerCommitmentDate ?? current.customerCommitmentDate,
      isCustomerDeliverable,
      "Customer commitment date",
    );
  }

  if (status === "blocked") {
    update.blockedReason = normalizeStateReason(
      value.blockedReason ?? current.blockedReason ?? undefined,
      true,
      "Blocked reason",
    );
    update.blockedStartedAt = current.status === "blocked" ? current.blockedStartedAt : new Date();
  } else if (value.status !== undefined || value.blockedReason !== undefined) {
    update.blockedReason = null;
    update.blockedStartedAt = null;
  }

  if (status === "waiting_third_party") {
    update.waitingReason = normalizeStateReason(
      value.waitingReason ?? current.waitingReason ?? undefined,
      true,
      "Waiting reason",
    );
    update.waitingFor = normalizeWaitingFor(
      value.waitingFor ?? current.waitingFor ?? undefined,
      true,
    );
    update.waitingStartedAt =
      current.status === "waiting_third_party" ? current.waitingStartedAt : new Date();
  } else if (
    value.status !== undefined ||
    value.waitingReason !== undefined ||
    value.waitingFor !== undefined
  ) {
    update.waitingReason = null;
    update.waitingFor = null;
    update.waitingStartedAt = null;
  }

  if (Object.keys(update).length === 1) {
    throw new ActivityValidationError("An Activity update must change at least one field.");
  }

  return update;
}

function normalizeActorUserId(value: unknown): string {
  return normalizeRequiredId(value, "Authenticated actor id");
}
function normalizeActivityId(value: unknown): string {
  return normalizeRequiredId(value, "Activity id");
}
function normalizeRequiredId(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new ActivityValidationError(`${field} must be a non-empty string.`);
  return value;
}
function optionalId(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  return normalizeRequiredId(value, field);
}
function normalizeName(value: unknown): string {
  if (typeof value !== "string")
    throw new ActivityValidationError("Activity name must be a string.");
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 200)
    throw new ActivityValidationError("Activity name must contain between 1 and 200 characters.");
  return normalized;
}
function normalizeDescription(value: unknown) {
  try {
    return normalizeActivityDescription(value);
  } catch {
    throw new ActivityValidationError(
      "Activity description must use the supported rich text format.",
    );
  }
}
function normalizeEstimatedHours(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    Math.round(value * 100) !== value * 100
  )
    throw new ActivityValidationError(
      "Estimated hours must be a positive number with at most two decimal places.",
    );
  return value;
}
function normalizeVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new ActivityValidationError("Activity version must be a positive integer.");
  return value as number;
}
function normalizeContainerType(value: unknown): ActivityContainerType {
  if (!(activityContainerTypes as readonly string[]).includes(value as string))
    throw new ActivityValidationError(
      "Activity container type must be project, requirement, or ticket.",
    );
  return value as ActivityContainerType;
}
function normalizeStatus(value: unknown): ActivityStatus {
  if (!(activityStatuses as readonly string[]).includes(value as string))
    throw new ActivityValidationError("Invalid Activity status.");
  return value as ActivityStatus;
}
function normalizePriority(value: unknown): ActivityPriority {
  if (!(activityPriorities as readonly string[]).includes(value as string))
    throw new ActivityValidationError("Invalid Activity priority.");
  return value as ActivityPriority;
}
function normalizeWaitingFor(
  value: unknown,
  required: boolean,
): ActivityWaitingFor | null | undefined {
  if (value === undefined || value === null) {
    if (required)
      throw new ActivityValidationError(
        "Waiting for is required when an Activity waits for a third party.",
      );
    return value;
  }
  if (!(activityWaitingForValues as readonly string[]).includes(value as string))
    throw new ActivityValidationError("Waiting for must be client, provider, or other.");
  return value as ActivityWaitingFor;
}
function normalizeStateReason(
  value: unknown,
  required: boolean,
  field: string,
): string | null | undefined {
  if (value === undefined || value === null) {
    if (required) throw new ActivityValidationError(`${field} is required.`);
    return value;
  }
  if (typeof value !== "string") throw new ActivityValidationError(`${field} must be a string.`);
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 2000)
    throw new ActivityValidationError(`${field} must contain between 1 and 2000 characters.`);
  return normalized;
}
function normalizeOptionalDate(value: unknown, field: string): string | null | undefined {
  if (value === undefined || value === null) return value;
  return normalizeDate(value, field);
}
function normalizeConditionalDate(value: unknown, required: boolean, field: string): string | null {
  if (value === undefined || value === null) {
    if (required)
      throw new ActivityValidationError(`${field} is required for customer deliverables.`);
    return null;
  }
  if (!required)
    throw new ActivityValidationError(
      `${field} must be empty when the Activity is not a customer deliverable.`,
    );
  return normalizeDate(value, field);
}
function normalizeDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new ActivityValidationError(`${field} must use the YYYY-MM-DD format.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    throw new ActivityValidationError(`${field} must be a valid calendar date.`);
  return value;
}
function normalizeSearch(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string")
    throw new ActivityValidationError("Activity search query must be a string.");
  return value.trim() || null;
}
