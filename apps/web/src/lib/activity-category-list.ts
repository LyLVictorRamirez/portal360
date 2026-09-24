import type { ActivityCategory } from "./activity-categories-client";

export type ActivityCategoryAvailabilityFilter = "active" | "all" | "inactive";

export function filterActivityCategories(
  categories: readonly ActivityCategory[],
  filters: Readonly<{ availability: ActivityCategoryAvailabilityFilter; query: string }>,
): readonly ActivityCategory[] {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase("es-CO");
  return categories.filter(
    (category) =>
      (filters.availability === "all" ||
        (filters.availability === "active" && category.isActive) ||
        (filters.availability === "inactive" && !category.isActive)) &&
      (normalizedQuery.length === 0 ||
        category.name.toLocaleLowerCase("es-CO").includes(normalizedQuery)),
  );
}

export function paginateActivityCategories(
  categories: readonly ActivityCategory[],
  page: number,
  pageSize: number,
): readonly ActivityCategory[] {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const start = (safePage - 1) * safePageSize;
  return categories.slice(start, start + safePageSize);
}
