export type Client = Readonly<{
  code: string;
  id: string;
  isActive: boolean;
  name: string;
  version: number;
}>;

export type ClientCodeSettings = Readonly<{
  codeLength: number;
  nextSequence: string;
  prefix: string;
  version: number;
}>;

export type ClientList = Readonly<{
  clients: readonly Client[];
  page: number;
  pageSize: number;
  total: number;
}>;

export type ClientStatusFilter = "active" | "all" | "inactive";

export type ListClientsInput = Readonly<{
  page?: number;
  query?: string;
  status?: ClientStatusFilter;
}>;

export type CreateClientInput = Readonly<{
  name: string;
}>;

export type UpdateClientInput = Readonly<{
  isActive?: boolean;
  name?: string;
  version: number;
}>;

export type UpdateClientCodeSettingsInput = Readonly<{
  codeLength: number;
  nextSequence: string;
  prefix: string;
  version: number;
}>;

export type ClientApiResult<Value> =
  | Readonly<{ data: Value; kind: "success" }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "conflict"; message: string }>
  | Readonly<{ kind: "validation"; message: string }>
  | Readonly<{ kind: "error"; message: string }>;

export async function listClients(
  input: ListClientsInput = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<ClientApiResult<ClientList>> {
  const searchParams = new URLSearchParams();

  if (input.page !== undefined) {
    searchParams.set("page", String(input.page));
  }

  const query = input.query?.trim();

  if (query) {
    searchParams.set("query", query);
  }

  if (input.status !== undefined) {
    searchParams.set("status", input.status);
  }

  return requestClientData(
    `/api/clients${searchParams.size ? `?${searchParams}` : ""}`,
    readClientList,
    fetchImplementation,
    "No fue posible cargar los Clientes.",
  );
}

export async function getClient(
  clientId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<ClientApiResult<Client>> {
  return requestClientData(
    `/api/clients/${encodeURIComponent(clientId)}`,
    (value) => readClientFromRecord(value, "client"),
    fetchImplementation,
    "No fue posible cargar el Cliente.",
  );
}

export async function createClient(
  input: CreateClientInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<ClientApiResult<Client>> {
  return mutateClient(
    "/api/clients",
    "POST",
    input,
    (value) => readClientFromRecord(value, "client"),
    fetchImplementation,
    "No fue posible crear el Cliente.",
  );
}

export async function updateClient(
  clientId: string,
  input: UpdateClientInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<ClientApiResult<Client>> {
  return mutateClient(
    `/api/clients/${encodeURIComponent(clientId)}`,
    "PUT",
    input,
    (value) => readClientFromRecord(value, "client"),
    fetchImplementation,
    "No fue posible guardar el Cliente.",
  );
}

export async function deleteClient(
  clientId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<ClientApiResult<void>> {
  try {
    const response = await fetchImplementation(`/api/clients/${encodeURIComponent(clientId)}`, {
      method: "DELETE",
    });
    const error = await readClientApiError(response);

    if (error) {
      return error;
    }

    return { data: undefined, kind: "success" };
  } catch {
    return { kind: "error", message: "No fue posible eliminar el Cliente." };
  }
}

export async function getClientCodeSettings(
  fetchImplementation: typeof fetch = fetch,
): Promise<ClientApiResult<ClientCodeSettings>> {
  return requestClientData(
    "/api/clients/settings/code",
    (value) => readCodeSettingsFromRecord(value, "settings"),
    fetchImplementation,
    "No fue posible cargar la configuración de códigos.",
  );
}

export async function updateClientCodeSettings(
  input: UpdateClientCodeSettingsInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<ClientApiResult<ClientCodeSettings>> {
  return mutateClient(
    "/api/clients/settings/code",
    "PUT",
    input,
    (value) => readCodeSettingsFromRecord(value, "settings"),
    fetchImplementation,
    "No fue posible guardar la configuración de códigos.",
  );
}

async function mutateClient<Value>(
  path: string,
  method: "POST" | "PUT",
  input: CreateClientInput | UpdateClientInput | UpdateClientCodeSettingsInput,
  readValue: (value: unknown) => Value | null,
  fetchImplementation: typeof fetch,
  connectionErrorMessage: string,
): Promise<ClientApiResult<Value>> {
  try {
    const response = await fetchImplementation(path, {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" },
      method,
    });
    const error = await readClientApiError(response);

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

async function requestClientData<Value>(
  path: string,
  readValue: (value: unknown) => Value | null,
  fetchImplementation: typeof fetch,
  connectionErrorMessage: string,
): Promise<ClientApiResult<Value>> {
  try {
    const response = await fetchImplementation(path, { cache: "no-store" });
    const error = await readClientApiError(response);

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

async function readClientApiError(
  response: Response,
): Promise<Exclude<ClientApiResult<never>, { kind: "success" }> | null> {
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

function readClientList(value: unknown): ClientList | null {
  if (!isRecord(value) || !Array.isArray(value.clients)) {
    return null;
  }

  const clients: Client[] = [];

  for (const clientValue of value.clients) {
    const client = readClient(clientValue);

    if (!client) {
      return null;
    }

    clients.push(client);
  }

  if (
    !isPositiveInteger(value.page) ||
    !isPositiveInteger(value.pageSize) ||
    !isPositiveOrZeroInteger(value.total)
  ) {
    return null;
  }

  return { clients, page: value.page, pageSize: value.pageSize, total: value.total };
}

function readClientFromRecord(value: unknown, key: string): Client | null {
  return isRecord(value) ? readClient(value[key]) : null;
}

function readClient(value: unknown): Client | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.code !== "string" ||
    typeof value.id !== "string" ||
    typeof value.isActive !== "boolean" ||
    typeof value.name !== "string" ||
    !isPositiveInteger(value.version)
  ) {
    return null;
  }

  return {
    code: value.code,
    id: value.id,
    isActive: value.isActive,
    name: value.name,
    version: value.version,
  };
}

function readCodeSettingsFromRecord(value: unknown, key: string): ClientCodeSettings | null {
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

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isPositiveOrZeroInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
