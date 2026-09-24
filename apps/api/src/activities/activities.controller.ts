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
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";

import { AuthorizationContext } from "../authorization/authorization-context.decorator.js";
import { AuthorizationGuard } from "../authorization/authorization.guard.js";
import { RequirePermissions } from "../authorization/require-permissions.decorator.js";
import type { AuthorizationRequestContext } from "../authorization/authorization.types.js";
import {
  type Activity,
  type ActivityAssignee,
  type ActivityAuditEvent,
  type ActivityDependencies,
  ActivityAssigneeInvalidError,
  ActivityCategoryInactiveError,
  ActivityContainerNotFoundError,
  ActivityContainerTerminalError,
  ActivityDependencyValidationError,
  ActivityNotFoundError,
  ActivityOrderError,
  ActivityRelatedRecordsError,
  ActivityValidationError,
  ActivityVersionConflictError,
  type CreateActivityInput,
  type CreateActivityDependencyInput,
  type DeleteActivityDependencyInput,
  type DeleteActivityInput,
  type ListActivitiesInput,
  type MoveActivityInput,
  type UpdateActivityInput,
} from "./activities.contracts.js";
import { ActivityService } from "./activities.service.js";

export interface ActivitiesControllerStore {
  createActivity(input: CreateActivityInput, actorUserId: string): Promise<Activity>;
  createActivityDependency(
    successorActivityId: string,
    input: CreateActivityDependencyInput,
    actorUserId: string,
  ): Promise<ActivityDependencies>;
  deleteActivity(
    activityId: string,
    input: DeleteActivityInput,
    actorUserId: string,
  ): Promise<void>;
  deleteActivityDependency(
    successorActivityId: string,
    predecessorActivityId: string,
    input: DeleteActivityDependencyInput,
    actorUserId: string,
  ): Promise<ActivityDependencies>;
  getActivity(activityId: string): Promise<Activity>;
  listActivityDependencies(activityId: string): Promise<ActivityDependencies>;
  listAuditEvents(activityId: string): Promise<ActivityAuditEvent[]>;
  listAssignees(query: string | undefined): Promise<ActivityAssignee[]>;
  listActivities(
    input: ListActivitiesInput,
  ): Promise<{ activities: Activity[]; page: number; pageSize: number; total: number }>;
  moveActivity(
    activityId: string,
    input: MoveActivityInput,
    actorUserId: string,
  ): Promise<Activity>;
  updateActivity(
    activityId: string,
    input: UpdateActivityInput,
    actorUserId: string,
  ): Promise<Activity>;
}

@Controller("api/activities")
@UseGuards(AuthorizationGuard)
export class ActivitiesController {
  constructor(
    @Inject(ActivityService) private readonly activityService: ActivitiesControllerStore,
  ) {}
  @Get()
  @RequirePermissions("activities.read")
  async listActivities(
    @Query() query: Record<string, string | undefined>,
  ): Promise<{ activities: Activity[]; page: number; pageSize: number; total: number }> {
    try {
      return await this.activityService.listActivities(readListInput(query));
    } catch (error) {
      throw toHttpException(error);
    }
  }
  @Post()
  @RequirePermissions("activities.manage")
  async createActivity(
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ activity: Activity }> {
    try {
      return {
        activity: await this.activityService.createActivity(readCreateInput(body), context.userId),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }
  @Get("assignees")
  @RequirePermissions("activities.manage")
  async listAssignees(
    @Query("query") query: string | undefined,
  ): Promise<{ assignees: ActivityAssignee[] }> {
    try {
      return { assignees: await this.activityService.listAssignees(query) };
    } catch (error) {
      throw toHttpException(error);
    }
  }
  @Get(":activityId/dependencies")
  @RequirePermissions("activities.read")
  async listActivityDependencies(
    @Param("activityId") activityId: string,
  ): Promise<ActivityDependencies> {
    try {
      return await this.activityService.listActivityDependencies(activityId);
    } catch (error) {
      throw toHttpException(error);
    }
  }
  @Post(":activityId/dependencies")
  @RequirePermissions("activities.manage")
  async createActivityDependency(
    @Param("activityId") activityId: string,
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<ActivityDependencies> {
    try {
      return await this.activityService.createActivityDependency(
        activityId,
        readCreateDependencyInput(body),
        context.userId,
      );
    } catch (error) {
      throw toHttpException(error);
    }
  }
  @Get(":activityId")
  @RequirePermissions("activities.read")
  async getActivity(@Param("activityId") activityId: string): Promise<{ activity: Activity }> {
    try {
      return { activity: await this.activityService.getActivity(activityId) };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Get(":activityId/audit-events")
  @RequirePermissions("activities.read")
  async listAuditEvents(
    @Param("activityId") activityId: string,
  ): Promise<{ events: ActivityAuditEvent[] }> {
    try {
      return { events: await this.activityService.listAuditEvents(activityId) };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Put(":activityId")
  @RequirePermissions("activities.manage")
  async updateActivity(
    @Param("activityId") activityId: string,
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ activity: Activity }> {
    try {
      return {
        activity: await this.activityService.updateActivity(
          activityId,
          readUpdateInput(body),
          context.userId,
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }
  @Post(":activityId/move")
  @RequirePermissions("activities.manage")
  async moveActivity(
    @Param("activityId") activityId: string,
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ activity: Activity }> {
    try {
      return {
        activity: await this.activityService.moveActivity(
          activityId,
          readMoveInput(body),
          context.userId,
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }
  @Delete(":activityId/dependencies/:predecessorActivityId")
  @RequirePermissions("activities.manage")
  async deleteActivityDependency(
    @Param("activityId") activityId: string,
    @Param("predecessorActivityId") predecessorActivityId: string,
    @Query("version") version: string | undefined,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<ActivityDependencies> {
    try {
      return await this.activityService.deleteActivityDependency(
        activityId,
        predecessorActivityId,
        { version: readVersionQuery(version) },
        context.userId,
      );
    } catch (error) {
      throw toHttpException(error);
    }
  }
  @Delete(":activityId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("activities.manage")
  async deleteActivity(
    @Param("activityId") activityId: string,
    @Query("version") version: string | undefined,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<void> {
    try {
      await this.activityService.deleteActivity(
        activityId,
        { version: readVersionQuery(version) },
        context.userId,
      );
    } catch (error) {
      throw toHttpException(error);
    }
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BadRequestException("The request body must be an object.");
  return value as Record<string, unknown>;
}
function readCreateInput(body: unknown): CreateActivityInput {
  const record = readRecord(body);
  for (const key of [
    "activityCategoryId",
    "assignedUserId",
    "containerId",
    "containerType",
    "name",
  ]) {
    if (typeof record[key] !== "string") throw new BadRequestException(`${key} is required.`);
  }
  if (typeof record.estimatedHours !== "number")
    throw new BadRequestException("estimatedHours is required.");
  return record as unknown as CreateActivityInput;
}
function readCreateDependencyInput(body: unknown): CreateActivityDependencyInput {
  const record = readRecord(body);
  if (typeof record.predecessorActivityId !== "string") {
    throw new BadRequestException("predecessorActivityId is required.");
  }
  if (
    typeof record.version !== "number" ||
    !Number.isSafeInteger(record.version) ||
    record.version < 1
  ) {
    throw new BadRequestException("version must be a positive integer.");
  }
  return { predecessorActivityId: record.predecessorActivityId, version: record.version };
}
function readUpdateInput(body: unknown): UpdateActivityInput {
  const record = readRecord(body);
  if (
    typeof record.version !== "number" ||
    !Number.isSafeInteger(record.version) ||
    record.version < 1
  )
    throw new BadRequestException("version must be a positive integer.");
  return record as unknown as UpdateActivityInput;
}
function readMoveInput(body: unknown): MoveActivityInput {
  const record = readRecord(body);
  if (record.direction !== "up" && record.direction !== "down")
    throw new BadRequestException("direction must be up or down.");
  if (
    typeof record.version !== "number" ||
    !Number.isSafeInteger(record.version) ||
    record.version < 1
  )
    throw new BadRequestException("version must be a positive integer.");
  return { direction: record.direction, version: record.version };
}
function readVersionQuery(value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value) || Number(value) < 1)
    throw new BadRequestException("version must be a positive integer.");
  return Number(value);
}
function readListInput(query: Record<string, string | undefined>): ListActivitiesInput {
  const input: ListActivitiesInput = {};
  for (const key of [
    "activityCategoryId",
    "assignedUserId",
    "clientId",
    "containerId",
    "containerType",
    "priority",
    "query",
    "status",
  ] as const) {
    if (query[key] !== undefined) input[key] = query[key] as never;
  }
  if (query.page !== undefined) {
    if (!/^\d+$/.test(query.page) || Number(query.page) < 1)
      throw new BadRequestException("page must be a positive integer.");
    input.page = Number(query.page);
  }
  return input;
}
function toHttpException(error: unknown): Error {
  if (error instanceof ActivityNotFoundError || error instanceof ActivityContainerNotFoundError)
    return new NotFoundException(error.message);
  if (error instanceof ActivityVersionConflictError || error instanceof ActivityRelatedRecordsError)
    return new ConflictException(error.message);
  if (
    error instanceof ActivityValidationError ||
    error instanceof ActivityDependencyValidationError ||
    error instanceof ActivityCategoryInactiveError ||
    error instanceof ActivityAssigneeInvalidError ||
    error instanceof ActivityContainerTerminalError ||
    error instanceof ActivityOrderError
  )
    return new UnprocessableEntityException(error.message);
  return error instanceof Error ? error : new Error("Activity operation failed.");
}
