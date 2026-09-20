export const requirementStatuses = [
  "new",
  "in_analysis",
  "quoted",
  "approved",
  "in_execution",
  "closed",
  "cancelled",
] as const;

export type RequirementStatus = (typeof requirementStatuses)[number];
export type RequirementStatusFilter = "all" | RequirementStatus;

export type RequirementClient = Readonly<{
  code: string;
  id: string;
  name: string;
}>;

export type Requirement = Readonly<{
  approvedByUserId: string | null;
  approvedOn: string | null;
  client: RequirementClient;
  code: string;
  committedOn: string | null;
  description: string | null;
  id: string;
  name: string;
  quotedOn: string | null;
  requestedOn: string;
  status: RequirementStatus;
  version: number;
}>;

export type RequirementCodeSettings = Readonly<{
  codeLength: number;
  nextSequence: string;
  prefix: string;
  version: number;
}>;

export type RequirementList = Readonly<{
  page: number;
  pageSize: number;
  requirements: readonly Requirement[];
  total: number;
}>;

export type ListRequirementsInput = Readonly<{
  clientId?: string;
  page?: number;
  query?: string;
  status?: RequirementStatusFilter;
}>;

export type CreateRequirementInput = Readonly<{
  clientId: string;
  committedOn?: string | null;
  description?: string | null;
  name: string;
  requestedOn: string;
}>;

export type UpdateRequirementInput = Readonly<{
  approvedOn?: string | null;
  committedOn?: string | null;
  description?: string | null;
  name?: string;
  quotedOn?: string | null;
  requestedOn?: string;
  status?: RequirementStatus;
  version: number;
}>;

export type UpdateRequirementCodeSettingsInput = Readonly<{
  codeLength: number;
  nextSequence: string;
  prefix: string;
  version: number;
}>;

export type RequirementApiResult<Value> =
  | Readonly<{ data: Value; kind: "success" }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "conflict"; message: string }>
  | Readonly<{ kind: "validation"; message: string }>
  | Readonly<{ kind: "error"; message: string }>;

export async function listRequirements(
  input: ListRequirementsInput = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<RequirementApiResult<RequirementList>> {
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

  return requestRequirementData(
    `/api/requirements${searchParams.size ? `?${searchParams}` : ""}`,
    readRequirementList,
    fetchImplementation,
    "No fue posible cargar los Requerimientos.",
  );
}

export async function getRequirement(
  requirementId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<RequirementApiResult<Requirement>> {
  return requestRequirementData(
    `/api/requirements/${encodeURIComponent(requirementId)}`,
    (value) => readRequirementFromRecord(value, "requirement"),
    fetchImplementation,
    "No fue posible cargar el Requerimiento.",
  );
}

export async function createRequirement(
  input: CreateRequirementInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<RequirementApiResult<Requirement>> {
  return mutateRequirement(
    "/api/requirements",
    "POST",
    input,
    (value) => readRequirementFromRecord(value, "requirement"),
    fetchImplementation,
    "No fue posible crear el Requerimiento.",
  );
}

export async function updateRequirement(
  requirementId: string,
  input: UpdateRequirementInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<RequirementApiResult<Requirement>> {
  return mutateRequirement(
    `/api/requirements/${encodeURIComponent(requirementId)}`,
    "PUT",
    input,
    (value) => readRequirementFromRecord(value, "requirement"),
    fetchImplementation,
    "No fue posible guardar el Requerimiento.",
  );
}

export async function deleteRequirement(
  requirementId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<RequirementApiResult<void>> {
  try {
    const response = await fetchImplementation(
      `/api/requirements/${encodeURIComponent(requirementId)}`,
      { method: "DELETE" },
    );
    const error = await readRequirementApiError(response);

    if (error) {
      return error;
    }

    return { data: undefined, kind: "success" };
  } catch {
    return { kind: "error", message: "No fue posible eliminar el Requerimiento." };
  }
}

export async function getRequirementCodeSettings(
  fetchImplementation: typeof fetch = fetch,
): Promise<RequirementApiResult<RequirementCodeSettings>> {
  return requestRequirementData(
    "/api/requirements/settings/code",
    (value) => readCodeSettingsFromRecord(value, "settings"),
    fetchImplementation,
    "No fue posible cargar la configuración de códigos.",
  );
}

export async function updateRequirementCodeSettings(
  input: UpdateRequirementCodeSettingsInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<RequirementApiResult<RequirementCodeSettings>> {
  return mutateRequirement(
    "/api/requirements/settings/code",
    "PUT",
    input,
    (value) => readCodeSettingsFromRecord(value, "settings"),
    fetchImplementation,
    "No fue posible guardar la configuración de códigos.",
  );
}

async function mutateRequirement<Value>(
  path: string,
  method: "POST" | "PUT",
  input: CreateRequirementInput | UpdateRequirementInput | UpdateRequirementCodeSettingsInput,
  readValue: (value: unknown) => Value | null,
  fetchImplementation: typeof fetch,
  connectionErrorMessage: string,
): Promise<RequirementApiResult<Value>> {
  try {
    const response = await fetchImplementation(path, {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" },
      method,
    });
    const error = await readRequirementApiError(response);

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

async function requestRequirementData<Value>(
  path: string,
  readValue: (value: unknown) => Value | null,
  fetchImplementation: typeof fetch,
  connectionErrorMessage: string,
): Promise<RequirementApiResult<Value>> {
  try {
    const response = await fetchImplementation(path, { cache: "no-store" });
    const error = await readRequirementApiError(response);

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

async function readRequirementApiError(
  response: Response,
): Promise<Exclude<RequirementApiResult<never>, { kind: "success" }> | null> {
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

function readRequirementList(value: unknown): RequirementList | null {
  if (!isRecord(value) || !Array.isArray(value.requirements)) {
    return null;
  }

  const requirements: Requirement[] = [];

  for (const requirementValue of value.requirements) {
    const requirement = readRequirement(requirementValue);

    if (!requirement) {
      return null;
    }

    requirements.push(requirement);
  }

  if (
    !isPositiveInteger(value.page) ||
    !isPositiveInteger(value.pageSize) ||
    !isPositiveOrZeroInteger(value.total)
  ) {
    return null;
  }

  return { page: value.page, pageSize: value.pageSize, requirements, total: value.total };
}

function readRequirementFromRecord(value: unknown, key: string): Requirement | null {
  return isRecord(value) ? readRequirement(value[key]) : null;
}

function readRequirement(value: unknown): Requirement | null {
  if (!isRecord(value) || !isRecord(value.client)) {
    return null;
  }

  const client = value.client;

  if (
    (value.approvedByUserId !== null && typeof value.approvedByUserId !== "string") ||
    !isNullableDateOnly(value.approvedOn) ||
    typeof client.code !== "string" ||
    typeof client.id !== "string" ||
    typeof client.name !== "string" ||
    typeof value.code !== "string" ||
    !isNullableDateOnly(value.committedOn) ||
    (value.description !== null && typeof value.description !== "string") ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !isNullableDateOnly(value.quotedOn) ||
    !isDateOnly(value.requestedOn) ||
    !isRequirementStatus(value.status) ||
    !isPositiveInteger(value.version)
  ) {
    return null;
  }

  return {
    approvedByUserId: value.approvedByUserId,
    approvedOn: value.approvedOn,
    client: { code: client.code, id: client.id, name: client.name },
    code: value.code,
    committedOn: value.committedOn,
    description: value.description,
    id: value.id,
    name: value.name,
    quotedOn: value.quotedOn,
    requestedOn: value.requestedOn,
    status: value.status,
    version: value.version,
  };
}

function readCodeSettingsFromRecord(value: unknown, key: string): RequirementCodeSettings | null {
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

function isNullableDateOnly(value: unknown): value is string | null {
  return value === null || isDateOnly(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isPositiveOrZeroInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRequirementStatus(value: unknown): value is RequirementStatus {
  return (requirementStatuses as readonly string[]).includes(value as string);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
