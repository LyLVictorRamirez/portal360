import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
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
  type ActivityCategory,
  ActivityCategoryNameConflictError,
  ActivityCategoryNotFoundError,
  ActivityCategoryValidationError,
  ActivityCategoryVersionConflictError,
  type CreateActivityCategoryInput,
  type UpdateActivityCategoryInput,
} from "./activity-categories.contracts.js";
import { ActivityCategoryService } from "./activity-categories.service.js";

interface ActivityCategoryResponse {
  id: string;
  isActive: boolean;
  name: string;
  version: number;
}

export interface ActivityCategoriesControllerStore {
  createCategory(
    input: CreateActivityCategoryInput,
    actorUserId: string,
  ): Promise<ActivityCategory>;
  listCategories(includeInactive?: boolean): Promise<ActivityCategory[]>;
  updateCategory(
    categoryId: string,
    input: UpdateActivityCategoryInput,
    actorUserId: string,
  ): Promise<ActivityCategory>;
}

@Controller("api/activity-categories")
@UseGuards(AuthorizationGuard)
export class ActivityCategoriesController {
  constructor(
    @Inject(ActivityCategoryService)
    private readonly categoryService: ActivityCategoriesControllerStore,
  ) {}

  @Get()
  @RequirePermissions("activities.read")
  async listCategories(
    @Query("includeInactive") includeInactiveQuery: string | undefined,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ categories: ActivityCategoryResponse[] }> {
    const includeInactive = readIncludeInactive(includeInactiveQuery);

    if (
      includeInactive &&
      !context.authorization.permissions.includes("activity-categories.manage")
    ) {
      throw new ForbiddenException("The current user cannot view inactive Activity categories.");
    }

    return {
      categories: (await this.categoryService.listCategories(includeInactive)).map(
        toCategoryResponse,
      ),
    };
  }

  @Post()
  @RequirePermissions("activity-categories.manage")
  async createCategory(
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ category: ActivityCategoryResponse }> {
    try {
      return {
        category: toCategoryResponse(
          await this.categoryService.createCategory(readCreateInput(body), context.userId),
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Put(":categoryId")
  @RequirePermissions("activity-categories.manage")
  async updateCategory(
    @Param("categoryId") categoryId: string,
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ category: ActivityCategoryResponse }> {
    try {
      return {
        category: toCategoryResponse(
          await this.categoryService.updateCategory(
            categoryId,
            readUpdateInput(body),
            context.userId,
          ),
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }
}

function readCreateInput(body: unknown): CreateActivityCategoryInput {
  const record = readRecord(body);

  if (typeof record.name !== "string") {
    throw new BadRequestException("name is required.");
  }

  return { name: record.name };
}

function readIncludeInactive(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  if (value !== "true") {
    throw new BadRequestException("includeInactive must be true when provided.");
  }

  return true;
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("The request body must be an object.");
  }

  return value as Record<string, unknown>;
}

function readUpdateInput(body: unknown): UpdateActivityCategoryInput {
  const record = readRecord(body);

  if (
    typeof record.version !== "number" ||
    !Number.isSafeInteger(record.version) ||
    record.version < 1
  ) {
    throw new BadRequestException("version must be a positive integer.");
  }

  if (record.name !== undefined && typeof record.name !== "string") {
    throw new BadRequestException("name must be a string when provided.");
  }

  if (record.isActive !== undefined && typeof record.isActive !== "boolean") {
    throw new BadRequestException("isActive must be boolean when provided.");
  }

  return {
    isActive: record.isActive as boolean | undefined,
    name: record.name as string | undefined,
    version: record.version,
  };
}

function toCategoryResponse(category: ActivityCategory): ActivityCategoryResponse {
  return {
    id: category.id,
    isActive: category.isActive,
    name: category.name,
    version: category.version,
  };
}

function toHttpException(error: unknown): Error {
  if (error instanceof ActivityCategoryNotFoundError) {
    return new NotFoundException(error.message);
  }

  if (error instanceof ActivityCategoryVersionConflictError) {
    return new ConflictException(error.message);
  }

  if (
    error instanceof ActivityCategoryNameConflictError ||
    error instanceof ActivityCategoryValidationError
  ) {
    return new UnprocessableEntityException(error.message);
  }

  return error instanceof Error ? error : new Error("Activity category operation failed.");
}
