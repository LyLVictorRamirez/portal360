export type ActivityCategory = Readonly<{
  id: string;
  name: string;
  isActive: boolean;
  version: number;
}>;
export type ActivityCategoryApiResult<T> =
  | Readonly<{ kind: "success"; data: T }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "conflict"; message: string }>
  | Readonly<{ kind: "validation"; message: string }>
  | Readonly<{ kind: "error"; message: string }>;
export async function listActivityCategories(
  includeInactive = false,
  fetchImplementation: typeof fetch = fetch,
): Promise<ActivityCategoryApiResult<readonly ActivityCategory[]>> {
  return request(
    `/api/activity-categories${includeInactive ? "?includeInactive=true" : ""}`,
    fetchImplementation,
  );
}
export async function createActivityCategory(
  name: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<ActivityCategoryApiResult<ActivityCategory>> {
  return mutate("/api/activity-categories", "POST", { name }, fetchImplementation);
}
export async function updateActivityCategory(
  id: string,
  input: Readonly<{ name?: string; isActive?: boolean; version: number }>,
  fetchImplementation: typeof fetch = fetch,
): Promise<ActivityCategoryApiResult<ActivityCategory>> {
  return mutate(
    `/api/activity-categories/${encodeURIComponent(id)}`,
    "PUT",
    input,
    fetchImplementation,
  );
}
async function request(
  path: string,
  fetchImplementation: typeof fetch,
): Promise<ActivityCategoryApiResult<readonly ActivityCategory[]>> {
  try {
    const response = await fetchImplementation(path, { cache: "no-store" });
    const error = await apiError(response);
    if (error) return error;
    const categories = record(await response.json())?.categories;
    return Array.isArray(categories) && categories.every(readCategory)
      ? { kind: "success", data: categories as ActivityCategory[] }
      : { kind: "error", message: "La respuesta del servidor no es válida." };
  } catch {
    return { kind: "error", message: "No fue posible cargar las categorías." };
  }
}
async function mutate(
  path: string,
  method: "POST" | "PUT",
  input: unknown,
  fetchImplementation: typeof fetch,
): Promise<ActivityCategoryApiResult<ActivityCategory>> {
  try {
    const response = await fetchImplementation(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const error = await apiError(response);
    if (error) return error;
    const category = record(await response.json())?.category;
    return readCategory(category)
      ? { kind: "success", data: category }
      : { kind: "error", message: "La respuesta del servidor no es válida." };
  } catch {
    return { kind: "error", message: "No fue posible guardar la categoría." };
  }
}
async function apiError(
  response: Response,
): Promise<Exclude<ActivityCategoryApiResult<never>, { kind: "success" }> | null> {
  if (response.ok) return null;
  if (response.status === 401 || response.status === 403) return { kind: "unauthorized" };
  let message = "No fue posible completar la operación.";
  try {
    const body = record(await response.json());
    if (typeof body?.message === "string") message = body.message;
  } catch {
    // Error bodies are optional.
  }
  return response.status === 409
    ? { kind: "conflict", message }
    : response.status === 400 || response.status === 422
      ? { kind: "validation", message }
      : { kind: "error", message };
}
function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function readCategory(value: unknown): value is ActivityCategory {
  const data = record(value);
  return (
    !!data &&
    typeof data.id === "string" &&
    typeof data.name === "string" &&
    typeof data.isActive === "boolean" &&
    typeof data.version === "number" &&
    Number.isSafeInteger(data.version) &&
    data.version > 0
  );
}
