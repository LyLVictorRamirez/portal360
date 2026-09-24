export interface ActivityCategory {
  createdAt: Date;
  createdByUserId: string | null;
  id: string;
  isActive: boolean;
  name: string;
  updatedAt: Date;
  updatedByUserId: string | null;
  version: number;
}

export interface CreateActivityCategoryInput {
  name: string;
}

export interface CreateActivityCategoryRecordInput extends CreateActivityCategoryInput {
  actorUserId: string;
}

export interface UpdateActivityCategoryInput {
  isActive?: boolean;
  name?: string;
  version: number;
}

export interface UpdateActivityCategoryRecordInput extends UpdateActivityCategoryInput {
  actorUserId: string;
}

export class ActivityCategoryNameConflictError extends Error {}

export class ActivityCategoryNotFoundError extends Error {}

export class ActivityCategoryValidationError extends Error {}

export class ActivityCategoryVersionConflictError extends Error {}
