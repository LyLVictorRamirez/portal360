import { Inject, Injectable } from "@nestjs/common";

import {
  type ActivityCategory,
  ActivityCategoryValidationError,
  type CreateActivityCategoryInput,
  type CreateActivityCategoryRecordInput,
  type UpdateActivityCategoryInput,
  type UpdateActivityCategoryRecordInput,
} from "./activity-categories.contracts.js";
import { ActivityCategoryRepository } from "./activity-categories.repository.js";

export interface ActivityCategoryStore {
  createCategory(input: CreateActivityCategoryRecordInput): Promise<ActivityCategory>;
  listCategories(includeInactive: boolean): Promise<ActivityCategory[]>;
  updateCategory(
    categoryId: string,
    input: UpdateActivityCategoryRecordInput,
  ): Promise<ActivityCategory>;
}

@Injectable()
export class ActivityCategoryService {
  constructor(
    @Inject(ActivityCategoryRepository) private readonly categoryRepository: ActivityCategoryStore,
  ) {}

  async listCategories(includeInactive = false): Promise<ActivityCategory[]> {
    return this.categoryRepository.listCategories(includeInactive);
  }

  async createCategory(
    input: CreateActivityCategoryInput,
    actorUserId: string,
  ): Promise<ActivityCategory> {
    return this.categoryRepository.createCategory({
      actorUserId: normalizeActorUserId(actorUserId),
      name: normalizeCategoryName(input?.name),
    });
  }

  async updateCategory(
    categoryId: string,
    input: UpdateActivityCategoryInput,
    actorUserId: string,
  ): Promise<ActivityCategory> {
    if (typeof input !== "object" || input === null) {
      throw new ActivityCategoryValidationError("Activity category update must be an object.");
    }

    if (!Number.isSafeInteger(input.version) || input.version < 1) {
      throw new ActivityCategoryValidationError(
        "Activity category version must be a positive integer.",
      );
    }

    if (input.name === undefined && input.isActive === undefined) {
      throw new ActivityCategoryValidationError(
        "An Activity category update must change its name or active state.",
      );
    }

    if (input.isActive !== undefined && typeof input.isActive !== "boolean") {
      throw new ActivityCategoryValidationError("Activity category active state must be boolean.");
    }

    const update: UpdateActivityCategoryRecordInput = {
      actorUserId: normalizeActorUserId(actorUserId),
      version: input.version,
    };

    if (input.isActive !== undefined) {
      update.isActive = input.isActive;
    }

    if (input.name !== undefined) {
      update.name = normalizeCategoryName(input.name);
    }

    return this.categoryRepository.updateCategory(normalizeCategoryId(categoryId), update);
  }
}

function normalizeActorUserId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ActivityCategoryValidationError(
      "An Activity category change must identify its authenticated actor.",
    );
  }

  return value;
}

function normalizeCategoryId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ActivityCategoryValidationError("Activity category id must be a non-empty string.");
  }

  return value;
}

function normalizeCategoryName(value: unknown): string {
  if (typeof value !== "string") {
    throw new ActivityCategoryValidationError("Activity category name must be a string.");
  }

  const name = value.trim();

  if (name.length < 1 || name.length > 100) {
    throw new ActivityCategoryValidationError(
      "Activity category name must contain between 1 and 100 characters.",
    );
  }

  return name;
}
