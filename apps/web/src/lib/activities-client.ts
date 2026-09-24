import { isActivityDescription, type ActivityDescription } from "./activity-description.ts";

export const activityStatuses = [
  "pending",
  "in_progress",
  "in_review",
  "customer_testing",
  "blocked",
  "waiting_third_party",
  "finalized",
] as const;
export type ActivityStatus = (typeof activityStatuses)[number];
export const activityPriorities = ["critical", "high", "medium", "low"] as const;
export type ActivityPriority = (typeof activityPriorities)[number];
export type Activity = Readonly<{
  id: string;
  name: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  version: number;
  clientName: string;
  containerId: string;
  containerName: string;
  containerType: "project" | "requirement" | "ticket";
  activityCategoryId: string;
  assignedUserId: string;
  assignedUserName: string;
  estimatedHours: number;
  position: number;
  projectStageId: string | null;
  projectStageName: string | null;
  parentActivityId: string | null;
  description: ActivityDescription | null;
  targetDate: string | null;
  isCustomerDeliverable: boolean;
  customerCommitmentDate: string | null;
  blockedReason: string | null;
  waitingReason: string | null;
  waitingFor: "client" | "provider" | "other" | null;
}>;
export type ActivityAuditEvent = Readonly<{
  id: string;
  action: "create" | "modify" | "delete";
  actorUserId: string;
  actorUserName: string;
  occurredAt: string;
  changes: Record<string, unknown>;
  reason: string | null;
}>;
<<<<<<< HEAD
=======
export type ActivityDependency = Readonly<{
  id: string;
  name: string;
  status: ActivityStatus;
  version: number;
}>;
export type ActivityDependencies = Readonly<{
  predecessors: readonly ActivityDependency[];
  successors: readonly ActivityDependency[];
}>;
export type ActivityDetail = Readonly<Activity & { dependencies: ActivityDependencies }>;
>>>>>>> spec-14-dependencias-de-actividades
export type ActivityAssignee = Readonly<{
  email: string;
  id: string;
  name: string;
}>;
export type ActivityList = Readonly<{
  activities: readonly Activity[];
  page: number;
  pageSize: number;
  total: number;
}>;
export type ActivityApiResult<T> =
  | Readonly<{ kind: "success"; data: T }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "conflict"; message: string }>
  | Readonly<{ kind: "validation"; message: string }>
  | Readonly<{ kind: "error"; message: string }>;
export type ListActivitiesInput = Readonly<{
  page?: number;
  query?: string;
  clientId?: string;
  containerId?: string;
  containerType?: Activity["containerType"];
  assignedUserId?: string;
  status?: ActivityStatus;
  priority?: ActivityPriority;
  activityCategoryId?: string;
}>;
export type CreateActivityInput = Readonly<Record<string, unknown>>;
export type UpdateActivityInput = Readonly<Record<string, unknown> & { version: number }>;
<<<<<<< HEAD
=======
export type CreateActivityDependencyInput = Readonly<{
  predecessorActivityId: string;
  version: number;
}>;
>>>>>>> spec-14-dependencias-de-actividades

export async function listActivities(
  input: ListActivitiesInput = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<ActivityApiResult<ActivityList>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && String(value).trim()) params.set(key, String(value).trim());
  }
  return request(
    `/api/activities${params.size ? `?${params}` : ""}`,
    readList,
    fetchImplementation,
    "No fue posible cargar las Actividades.",
  );
}
export async function getActivity(
  id: string,
  fetchImplementation: typeof fetch = fetch,
<<<<<<< HEAD
): Promise<ActivityApiResult<Activity>> {
  return request(
    `/api/activities/${encodeURIComponent(id)}`,
    (value) => readActivity(record(value)?.activity),
=======
): Promise<ActivityApiResult<ActivityDetail>> {
  return request(
    `/api/activities/${encodeURIComponent(id)}`,
    (value) => readActivityDetail(record(value)?.activity),
>>>>>>> spec-14-dependencias-de-actividades
    fetchImplementation,
    "No fue posible cargar la Actividad.",
  );
}
<<<<<<< HEAD
=======
export async function listActivityDependencies(
  id: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<ActivityApiResult<ActivityDependencies>> {
  return request(
    `/api/activities/${encodeURIComponent(id)}/dependencies`,
    readActivityDependencies,
    fetchImplementation,
    "No fue posible cargar las dependencias.",
  );
}
export async function createActivityDependency(
  id: string,
  input: CreateActivityDependencyInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<ActivityApiResult<ActivityDependencies>> {
  return mutateDependencies(
    `/api/activities/${encodeURIComponent(id)}/dependencies`,
    "POST",
    input,
    fetchImplementation,
    "No fue posible agregar la dependencia.",
  );
}
export async function deleteActivityDependency(
  id: string,
  predecessorActivityId: string,
  version: number,
  fetchImplementation: typeof fetch = fetch,
): Promise<ActivityApiResult<ActivityDependencies>> {
  return mutateDependencies(
    `/api/activities/${encodeURIComponent(id)}/dependencies/${encodeURIComponent(predecessorActivityId)}?version=${version}`,
    "DELETE",
    undefined,
    fetchImplementation,
    "No fue posible quitar la dependencia.",
  );
}
>>>>>>> spec-14-dependencias-de-actividades
export async function createActivity(
  input: CreateActivityInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<ActivityApiResult<Activity>> {
  return mutate(
    "/api/activities",
    "POST",
    input,
    fetchImplementation,
    "No fue posible crear la Actividad.",
  );
}
export async function updateActivity(
  id: string,
  input: UpdateActivityInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<ActivityApiResult<Activity>> {
  return mutate(
    `/api/activities/${encodeURIComponent(id)}`,
    "PUT",
    input,
    fetchImplementation,
    "No fue posible guardar la Actividad.",
  );
}
export async function moveActivity(
  id: string,
  direction: "up" | "down",
  version: number,
  fetchImplementation: typeof fetch = fetch,
): Promise<ActivityApiResult<Activity>> {
  return mutate(
    `/api/activities/${encodeURIComponent(id)}/move`,
    "POST",
    { direction, version },
    fetchImplementation,
    "No fue posible ordenar la Actividad.",
  );
}
export async function deleteActivity(
  id: string,
  version: number,
  fetchImplementation: typeof fetch = fetch,
): Promise<ActivityApiResult<void>> {
  try {
    const response = await fetchImplementation(
      `/api/activities/${encodeURIComponent(id)}?version=${version}`,
      { method: "DELETE" },
    );
    const error = await apiError(response);
    return error ?? { kind: "success", data: undefined };
  } catch {
    return { kind: "error", message: "No fue posible eliminar la Actividad." };
  }
}
export async function listActivityAuditEvents(
  id: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<ActivityApiResult<readonly ActivityAuditEvent[]>> {
  return request(
    `/api/activities/${encodeURIComponent(id)}/audit-events`,
    (value) => {
      const events = record(value)?.events;
      return Array.isArray(events) && events.every(readAuditEvent)
        ? (events as ActivityAuditEvent[])
        : null;
    },
    fetchImplementation,
    "No fue posible cargar la línea de tiempo.",
  );
}
export async function listActivityAssignees(
  query = "",
  fetchImplementation: typeof fetch = fetch,
): Promise<ActivityApiResult<readonly ActivityAssignee[]>> {
  const normalizedQuery = query.trim();
  const params = normalizedQuery ? `?query=${encodeURIComponent(normalizedQuery)}` : "";
  return request(
    `/api/activities/assignees${params}`,
    (value) => {
      const assignees = record(value)?.assignees;
      return Array.isArray(assignees) && assignees.every(readActivityAssignee)
        ? (assignees as ActivityAssignee[])
        : null;
    },
    fetchImplementation,
    "No fue posible cargar los responsables.",
  );
}
async function mutate(
  path: string,
  method: "POST" | "PUT",
  input: unknown,
  fetchImplementation: typeof fetch,
  message: string,
): Promise<ActivityApiResult<Activity>> {
  try {
    const response = await fetchImplementation(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const error = await apiError(response);
    if (error) return error;
    const activity = readActivity(record(await response.json())?.activity);
    return activity
      ? { kind: "success", data: activity }
      : { kind: "error", message: "La respuesta del servidor no es válida." };
  } catch {
    return { kind: "error", message };
  }
}
<<<<<<< HEAD
=======
async function mutateDependencies(
  path: string,
  method: "POST" | "DELETE",
  input: unknown,
  fetchImplementation: typeof fetch,
  message: string,
): Promise<ActivityApiResult<ActivityDependencies>> {
  try {
    const response = await fetchImplementation(path, {
      method,
      ...(input === undefined
        ? {}
        : { body: JSON.stringify(input), headers: { "content-type": "application/json" } }),
    });
    const error = await apiError(response);
    if (error) return error;
    const dependencies = readActivityDependencies(await response.json());
    return dependencies
      ? { kind: "success", data: dependencies }
      : { kind: "error", message: "La respuesta del servidor no es válida." };
  } catch {
    return { kind: "error", message };
  }
}
>>>>>>> spec-14-dependencias-de-actividades
async function request<T>(
  path: string,
  reader: (value: unknown) => T | null,
  fetchImplementation: typeof fetch,
  message: string,
): Promise<ActivityApiResult<T>> {
  try {
    const response = await fetchImplementation(path, { cache: "no-store" });
    const error = await apiError(response);
    if (error) return error;
    const data = reader(await response.json());
    return data
      ? { kind: "success", data }
      : { kind: "error", message: "La respuesta del servidor no es válida." };
  } catch {
    return { kind: "error", message };
  }
}
async function apiError(
  response: Response,
): Promise<Exclude<ActivityApiResult<never>, { kind: "success" }> | null> {
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
function readList(value: unknown): ActivityList | null {
  const data = record(value);
  if (
    !data ||
    !Array.isArray(data.activities) ||
    !Number.isSafeInteger(data.page) ||
    !Number.isSafeInteger(data.pageSize) ||
    !Number.isSafeInteger(data.total)
  )
    return null;
  const activities = data.activities.map(readActivity);
  return activities.every(Boolean)
    ? {
        activities: activities as Activity[],
        page: data.page as number,
        pageSize: data.pageSize as number,
        total: data.total as number,
      }
    : null;
}
function readActivity(value: unknown): Activity | null {
  const data = record(value);
  if (
    !data ||
    typeof data.id !== "string" ||
    typeof data.name !== "string" ||
    !activityStatuses.includes(data.status as ActivityStatus) ||
    !activityPriorities.includes(data.priority as ActivityPriority) ||
    !Number.isSafeInteger(data.version) ||
    typeof data.clientName !== "string" ||
    typeof data.containerId !== "string" ||
    typeof data.containerName !== "string" ||
    !["project", "requirement", "ticket"].includes(data.containerType as string) ||
    typeof data.activityCategoryId !== "string" ||
    typeof data.assignedUserId !== "string" ||
    typeof data.assignedUserName !== "string" ||
    typeof data.estimatedHours !== "number" ||
    !Number.isSafeInteger(data.position) ||
    typeof data.isCustomerDeliverable !== "boolean"
  )
    return null;
  if (data.projectStageName !== null && typeof data.projectStageName !== "string") return null;
  if (data.description !== null && !isActivityDescription(data.description)) return null;
  return data as Activity;
}
<<<<<<< HEAD
=======
function readActivityDetail(value: unknown): ActivityDetail | null {
  const activity = readActivity(value);
  if (!activity) return null;
  const dependencies = readActivityDependencies(record(value)?.dependencies);
  return dependencies ? { ...activity, dependencies } : null;
}
function readActivityDependencies(value: unknown): ActivityDependencies | null {
  const data = record(value);
  if (!data || !Array.isArray(data.predecessors) || !Array.isArray(data.successors)) return null;
  const predecessors = data.predecessors.map(readActivityDependency);
  const successors = data.successors.map(readActivityDependency);
  return predecessors.every(Boolean) && successors.every(Boolean)
    ? {
        predecessors: predecessors as ActivityDependency[],
        successors: successors as ActivityDependency[],
      }
    : null;
}
function readActivityDependency(value: unknown): ActivityDependency | null {
  const data = record(value);
  return data &&
    typeof data.id === "string" &&
    typeof data.name === "string" &&
    activityStatuses.includes(data.status as ActivityStatus) &&
    typeof data.version === "number" &&
    Number.isSafeInteger(data.version) &&
    data.version > 0
    ? (data as ActivityDependency)
    : null;
}
>>>>>>> spec-14-dependencias-de-actividades
function readAuditEvent(value: unknown): value is ActivityAuditEvent {
  const data = record(value);
  return (
    !!data &&
    typeof data.id === "string" &&
    ["create", "modify", "delete"].includes(data.action as string) &&
    typeof data.actorUserId === "string" &&
    typeof data.actorUserName === "string" &&
    typeof data.occurredAt === "string" &&
    !!record(data.changes) &&
    (data.reason === null || typeof data.reason === "string")
  );
}
function readActivityAssignee(value: unknown): value is ActivityAssignee {
  const data = record(value);
  return (
    !!data &&
    typeof data.email === "string" &&
    typeof data.id === "string" &&
    typeof data.name === "string"
  );
}
