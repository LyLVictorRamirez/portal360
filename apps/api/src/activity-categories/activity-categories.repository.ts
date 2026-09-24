import { Inject, Injectable } from "@nestjs/common";

import {
  type ActivityCategory,
  ActivityCategoryNameConflictError,
  ActivityCategoryNotFoundError,
  ActivityCategoryValidationError,
  ActivityCategoryVersionConflictError,
  type CreateActivityCategoryRecordInput,
  type UpdateActivityCategoryRecordInput,
} from "./activity-categories.contracts.js";

export const ACTIVITY_CATEGORIES_DATABASE = Symbol("ACTIVITY_CATEGORIES_DATABASE");

interface ActivityCategoriesQueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface ActivityCategoriesDatabase {
  query(query: string, values?: unknown[]): Promise<ActivityCategoriesQueryResult>;
}

const categorySelection = (table: string) => `
  "${table}"."id",
  "${table}"."name",
  "${table}"."is_active",
  "${table}"."version",
  "${table}"."created_at",
  "${table}"."created_by_user_id",
  "${table}"."updated_at",
  "${table}"."updated_by_user_id"
`;

const listCategoriesQuery = `
  select ${categorySelection("activity_category")}
  from "business"."activity_category" as "activity_category"
  where ($1::boolean or "activity_category"."is_active")
  order by lower("activity_category"."name"), "activity_category"."id"
`;

const findCategoryByIdQuery = `
  select ${categorySelection("activity_category")}
  from "business"."activity_category" as "activity_category"
  where "activity_category"."id" = $1
`;

const insertCategoryQuery = `
  insert into "business"."activity_category" (
    "name",
    "created_by_user_id",
    "updated_by_user_id"
  )
  values ($1, $2, $2)
  returning *
`;

const updateCategoryQuery = `
  update "business"."activity_category"
  set "name" = coalesce($2::varchar, "name"),
      "is_active" = case when $3::boolean then $4::boolean else "is_active" end,
      "updated_at" = current_timestamp,
      "updated_by_user_id" = $5,
      "version" = "version" + 1
  where "id" = $1 and "version" = $6
  returning *
`;

@Injectable()
export class ActivityCategoryRepository {
  constructor(
    @Inject(ACTIVITY_CATEGORIES_DATABASE) private readonly database: ActivityCategoriesDatabase,
  ) {}

  async listCategories(includeInactive: boolean): Promise<ActivityCategory[]> {
    const result = await this.database.query(listCategoriesQuery, [includeInactive]);

    return result.rows.map(readActivityCategory);
  }

  async createCategory(input: CreateActivityCategoryRecordInput): Promise<ActivityCategory> {
    try {
      const result = await this.database.query(insertCategoryQuery, [
        input.name,
        input.actorUserId,
      ]);
      const row = result.rows[0];

      if (!row) {
        throw new Error("The business database did not return the created Activity category.");
      }

      return readActivityCategory(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ActivityCategoryNameConflictError("An Activity category already has that name.");
      }

      if (isCheckViolation(error)) {
        throw new ActivityCategoryValidationError(
          "The Activity category does not satisfy its business rules.",
        );
      }

      throw error;
    }
  }

  async updateCategory(
    categoryId: string,
    input: UpdateActivityCategoryRecordInput,
  ): Promise<ActivityCategory> {
    try {
      const result = await this.database.query(updateCategoryQuery, [
        categoryId,
        input.name ?? null,
        input.isActive !== undefined,
        input.isActive ?? false,
        input.actorUserId,
        input.version,
      ]);
      const row = result.rows[0];

      if (row) {
        return readActivityCategory(row);
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ActivityCategoryNameConflictError("An Activity category already has that name.");
      }

      if (isCheckViolation(error)) {
        throw new ActivityCategoryValidationError(
          "The Activity category does not satisfy its business rules.",
        );
      }

      throw error;
    }

    const current = await this.database.query(findCategoryByIdQuery, [categoryId]);

    if (!current.rows[0]) {
      throw new ActivityCategoryNotFoundError(`Activity category ${categoryId} does not exist.`);
    }

    throw new ActivityCategoryVersionConflictError(
      "The Activity category was updated by another person. Reload it before saving again.",
    );
  }
}

function readActivityCategory(row: Record<string, unknown>): ActivityCategory {
  return {
    createdAt: readDate(row.created_at, "Activity category creation date"),
    createdByUserId: readNullableString(row.created_by_user_id, "Activity category creator"),
    id: readString(row.id, "Activity category id"),
    isActive: readBoolean(row.is_active, "Activity category active state"),
    name: readString(row.name, "Activity category name"),
    updatedAt: readDate(row.updated_at, "Activity category update date"),
    updatedByUserId: readNullableString(row.updated_by_user_id, "Activity category updater"),
    version: readPositiveInteger(row.version, "Activity category version"),
  };
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${field} returned by the business database.`);
  }

  return value;
}

function readDate(value: unknown, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`Invalid ${field} returned by the business database.`);
  }

  return value;
}

function readNullableString(value: unknown, field: string): string | null {
  return value === null ? null : readString(value, field);
}

function readPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Invalid ${field} returned by the business database.`);
  }

  return value;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid ${field} returned by the business database.`);
  }

  return value;
}

function isCheckViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23514"
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
