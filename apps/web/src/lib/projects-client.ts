export const projectStatuses = ["new", "in_execution", "paused", "finalized", "cancelled"] as const;

export type ProjectStatus = (typeof projectStatuses)[number];
export type ProjectStatusFilter = "all" | ProjectStatus;

export type ProjectClient = Readonly<{
  code: string;
  id: string;
  name: string;
}>;

export type Project = Readonly<{
  client: ProjectClient;
  code: string;
  committedEndDate: string;
  description: string | null;
  id: string;
  name: string;
  startDate: string;
  status: ProjectStatus;
  version: number;
}>;

export type ProjectCodeSettings = Readonly<{
  codeLength: number;
  nextSequence: string;
  prefix: string;
  version: number;
}>;

export type ProjectList = Readonly<{
  page: number;
  pageSize: number;
  projects: readonly Project[];
  total: number;
}>;

export type ListProjectsInput = Readonly<{
  clientId?: string;
  page?: number;
  query?: string;
  status?: ProjectStatusFilter;
}>;

export type CreateProjectInput = Readonly<{
  clientId: string;
  committedEndDate: string;
  description?: string | null;
  name: string;
  startDate: string;
  status?: ProjectStatus;
}>;

export type UpdateProjectInput = Readonly<{
  committedEndDate?: string;
  description?: string | null;
  name?: string;
  startDate?: string;
  status?: ProjectStatus;
  version: number;
}>;

export type UpdateProjectCodeSettingsInput = Readonly<{
  codeLength: number;
  nextSequence: string;
  prefix: string;
  version: number;
}>;

export type ProjectApiResult<Value> =
  | Readonly<{ data: Value; kind: "success" }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "conflict"; message: string }>
  | Readonly<{ kind: "validation"; message: string }>
  | Readonly<{ kind: "error"; message: string }>;

export async function listProjects(
  input: ListProjectsInput = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<ProjectApiResult<ProjectList>> {
  const searchParams = new URLSearchParams();

  if (input.page !== undefined) {
    searchParams.set("page", String(input.page));
  }

  const query = input.query?.trim();

  if (query) {
    searchParams.set("query", query);
  }

  const clientId = input.clientId?.trim();

  if (clientId) {
    searchParams.set("clientId", clientId);
  }

  if (input.status !== undefined) {
    searchParams.set("status", input.status);
  }

  return requestProjectData(
    `/api/projects${searchParams.size ? `?${searchParams}` : ""}`,
    readProjectList,
    fetchImplementation,
    "No fue posible cargar los Proyectos.",
  );
}

export async function getProject(
  projectId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<ProjectApiResult<Project>> {
  return requestProjectData(
    `/api/projects/${encodeURIComponent(projectId)}`,
    (value) => readProjectFromRecord(value, "project"),
    fetchImplementation,
    "No fue posible cargar el Proyecto.",
  );
}

export async function createProject(
  input: CreateProjectInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<ProjectApiResult<Project>> {
  return mutateProject(
    "/api/projects",
    "POST",
    input,
    (value) => readProjectFromRecord(value, "project"),
    fetchImplementation,
    "No fue posible crear el Proyecto.",
  );
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<ProjectApiResult<Project>> {
  return mutateProject(
    `/api/projects/${encodeURIComponent(projectId)}`,
    "PUT",
    input,
    (value) => readProjectFromRecord(value, "project"),
    fetchImplementation,
    "No fue posible guardar el Proyecto.",
  );
}

export async function deleteProject(
  projectId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<ProjectApiResult<void>> {
  try {
    const response = await fetchImplementation(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
    });
    const error = await readProjectApiError(response);

    if (error) {
      return error;
    }

    return { data: undefined, kind: "success" };
  } catch {
    return { kind: "error", message: "No fue posible eliminar el Proyecto." };
  }
}

export async function getProjectCodeSettings(
  fetchImplementation: typeof fetch = fetch,
): Promise<ProjectApiResult<ProjectCodeSettings>> {
  return requestProjectData(
    "/api/projects/settings/code",
    (value) => readCodeSettingsFromRecord(value, "settings"),
    fetchImplementation,
    "No fue posible cargar la configuración de códigos.",
  );
}

export async function updateProjectCodeSettings(
  input: UpdateProjectCodeSettingsInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<ProjectApiResult<ProjectCodeSettings>> {
  return mutateProject(
    "/api/projects/settings/code",
    "PUT",
    input,
    (value) => readCodeSettingsFromRecord(value, "settings"),
    fetchImplementation,
    "No fue posible guardar la configuración de códigos.",
  );
}

async function mutateProject<Value>(
  path: string,
  method: "POST" | "PUT",
  input: CreateProjectInput | UpdateProjectInput | UpdateProjectCodeSettingsInput,
  readValue: (value: unknown) => Value | null,
  fetchImplementation: typeof fetch,
  connectionErrorMessage: string,
): Promise<ProjectApiResult<Value>> {
  try {
    const response = await fetchImplementation(path, {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" },
      method,
    });
    const error = await readProjectApiError(response);

    if (error) {
      return error;
    }

    const value = readValue(await response.json());

    return value
      ? { data: value, kind: "success" }
      : { kind: "error", message: "La respuesta del servidor no es válida." };
  } catch {
    return { kind: "error", message: connectionErrorMessage };
  }
}

async function requestProjectData<Value>(
  path: string,
  readValue: (value: unknown) => Value | null,
  fetchImplementation: typeof fetch,
  connectionErrorMessage: string,
): Promise<ProjectApiResult<Value>> {
  try {
    const response = await fetchImplementation(path, { cache: "no-store" });
    const error = await readProjectApiError(response);

    if (error) {
      return error;
    }

    const value = readValue(await response.json());

    return value
      ? { data: value, kind: "success" }
      : { kind: "error", message: "La respuesta del servidor no es válida." };
  } catch {
    return { kind: "error", message: connectionErrorMessage };
  }
}

async function readProjectApiError(
  response: Response,
): Promise<Exclude<ProjectApiResult<never>, { kind: "success" }> | null> {
  if (response.ok) {
    return null;
  }

  if (response.status === 401 || response.status === 403) {
    return { kind: "unauthorized" };
  }

  const message = await readApiErrorMessage(response);

  if (response.status === 400) {
    return { kind: "validation", message };
  }

  if (response.status === 409) {
    return { kind: "conflict", message };
  }

  return { kind: "error", message };
}

function readProjectList(value: unknown): ProjectList | null {
  if (!isRecord(value) || !Array.isArray(value.projects)) {
    return null;
  }

  const projects: Project[] = [];

  for (const projectValue of value.projects) {
    const project = readProject(projectValue);

    if (!project) {
      return null;
    }

    projects.push(project);
  }

  if (
    !isPositiveInteger(value.page) ||
    !isPositiveInteger(value.pageSize) ||
    !isPositiveOrZeroInteger(value.total)
  ) {
    return null;
  }

  return { page: value.page, pageSize: value.pageSize, projects, total: value.total };
}

function readProjectFromRecord(value: unknown, key: string): Project | null {
  return isRecord(value) ? readProject(value[key]) : null;
}

function readProject(value: unknown): Project | null {
  if (!isRecord(value) || !isRecord(value.client)) {
    return null;
  }

  const client = value.client;

  if (
    typeof client.code !== "string" ||
    typeof client.id !== "string" ||
    typeof client.name !== "string" ||
    typeof value.code !== "string" ||
    !isDateOnly(value.committedEndDate) ||
    (value.description !== null && typeof value.description !== "string") ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !isDateOnly(value.startDate) ||
    !isProjectStatus(value.status) ||
    !isPositiveInteger(value.version)
  ) {
    return null;
  }

  return {
    client: { code: client.code, id: client.id, name: client.name },
    code: value.code,
    committedEndDate: value.committedEndDate,
    description: value.description,
    id: value.id,
    name: value.name,
    startDate: value.startDate,
    status: value.status,
    version: value.version,
  };
}

function readCodeSettingsFromRecord(value: unknown, key: string): ProjectCodeSettings | null {
  if (!isRecord(value) || !isRecord(value[key])) {
    return null;
  }

  const settings = value[key];

  if (
    !isPositiveInteger(settings.codeLength) ||
    typeof settings.nextSequence !== "string" ||
    !/^\d+$/.test(settings.nextSequence) ||
    BigInt(settings.nextSequence) < BigInt(1) ||
    typeof settings.prefix !== "string" ||
    !isPositiveInteger(settings.version)
  ) {
    return null;
  }

  return {
    codeLength: settings.codeLength,
    nextSequence: settings.nextSequence,
    prefix: settings.prefix,
    version: settings.version,
  };
}

async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const value = await response.json();

    if (isRecord(value) && typeof value.message === "string") {
      return value.message;
    }

    if (isRecord(value) && Array.isArray(value.message)) {
      const message = value.message.filter((item) => typeof item === "string").join(" ");

      if (message) {
        return message;
      }
    }
  } catch {
    // The response body is optional for an HTTP error.
  }

  return "No fue posible completar la operación.";
}

function isDateOnly(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isPositiveOrZeroInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return (projectStatuses as readonly string[]).includes(value as string);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
