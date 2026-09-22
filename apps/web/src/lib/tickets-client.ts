export const ticketExternalPriorities = ["critical", "high", "medium", "low"] as const;

export type TicketExternalPriority = (typeof ticketExternalPriorities)[number];
export type TicketExternalPriorityFilter = "all" | TicketExternalPriority;

export type TicketClient = Readonly<{ code: string; id: string; name: string }>;

export type Ticket = Readonly<{
  client: TicketClient;
  description: string | null;
  externalPriority: TicketExternalPriority;
  externalReference: string;
  externalUrl: string | null;
  id: string;
  title: string;
  version: number;
}>;

export type TicketList = Readonly<{
  page: number;
  pageSize: number;
  tickets: readonly Ticket[];
  total: number;
}>;

export type ListTicketsInput = Readonly<{
  clientId?: string;
  page?: number;
  priority?: TicketExternalPriorityFilter;
  query?: string;
}>;

export type CreateTicketInput = Readonly<{
  clientId: string;
  description?: string | null;
  externalPriority?: TicketExternalPriority;
  externalReference: string;
  externalUrl?: string | null;
  title: string;
}>;

export type UpdateTicketInput = Readonly<{
  description?: string | null;
  externalPriority?: TicketExternalPriority;
  externalReference?: string;
  externalUrl?: string | null;
  title?: string;
  version: number;
}>;

export type TicketApiResult<Value> =
  | Readonly<{ data: Value; kind: "success" }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "conflict"; message: string }>
  | Readonly<{ kind: "validation"; message: string }>
  | Readonly<{ kind: "error"; message: string }>;

export async function listTickets(
  input: ListTicketsInput = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<TicketApiResult<TicketList>> {
  const searchParams = new URLSearchParams();

  if (input.page !== undefined) {
    searchParams.set("page", String(input.page));
  }

  for (const [key, value] of [
    ["query", input.query],
    ["clientId", input.clientId],
  ] as const) {
    const normalized = value?.trim();

    if (normalized) {
      searchParams.set(key, normalized);
    }
  }

  if (input.priority !== undefined) {
    searchParams.set("priority", input.priority);
  }

  return requestTicketData(
    `/api/tickets${searchParams.size ? `?${searchParams}` : ""}`,
    readTicketList,
    fetchImplementation,
    "No fue posible cargar los Tickets.",
  );
}

export async function getTicket(
  ticketId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<TicketApiResult<Ticket>> {
  return requestTicketData(
    `/api/tickets/${encodeURIComponent(ticketId)}`,
    (value) => readTicketFromRecord(value, "ticket"),
    fetchImplementation,
    "No fue posible cargar el Ticket.",
  );
}

export async function createTicket(
  input: CreateTicketInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<TicketApiResult<Ticket>> {
  return mutateTicket(
    "/api/tickets",
    "POST",
    input,
    fetchImplementation,
    "No fue posible crear el Ticket.",
  );
}

export async function updateTicket(
  ticketId: string,
  input: UpdateTicketInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<TicketApiResult<Ticket>> {
  return mutateTicket(
    `/api/tickets/${encodeURIComponent(ticketId)}`,
    "PUT",
    input,
    fetchImplementation,
    "No fue posible guardar el Ticket.",
  );
}

export async function deleteTicket(
  ticketId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<TicketApiResult<void>> {
  try {
    const response = await fetchImplementation(`/api/tickets/${encodeURIComponent(ticketId)}`, {
      method: "DELETE",
    });
    const error = await readTicketApiError(response);

    return error ?? { data: undefined, kind: "success" };
  } catch {
    return { kind: "error", message: "No fue posible eliminar el Ticket." };
  }
}

async function mutateTicket(
  path: string,
  method: "POST" | "PUT",
  input: CreateTicketInput | UpdateTicketInput,
  fetchImplementation: typeof fetch,
  connectionErrorMessage: string,
): Promise<TicketApiResult<Ticket>> {
  try {
    const response = await fetchImplementation(path, {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" },
      method,
    });
    const error = await readTicketApiError(response);

    if (error) {
      return error;
    }

    const ticket = readTicketFromRecord(await response.json(), "ticket");

    return ticket
      ? { data: ticket, kind: "success" }
      : { kind: "error", message: "La respuesta del servidor no es válida." };
  } catch {
    return { kind: "error", message: connectionErrorMessage };
  }
}

async function requestTicketData<Value>(
  path: string,
  readValue: (value: unknown) => Value | null,
  fetchImplementation: typeof fetch,
  connectionErrorMessage: string,
): Promise<TicketApiResult<Value>> {
  try {
    const response = await fetchImplementation(path, { cache: "no-store" });
    const error = await readTicketApiError(response);

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

async function readTicketApiError(
  response: Response,
): Promise<Exclude<TicketApiResult<never>, { kind: "success" }> | null> {
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

  return response.status === 409 ? { kind: "conflict", message } : { kind: "error", message };
}

function readTicketList(value: unknown): TicketList | null {
  if (!isRecord(value) || !Array.isArray(value.tickets)) {
    return null;
  }

  const tickets: Ticket[] = [];

  for (const ticketValue of value.tickets) {
    const ticket = readTicket(ticketValue);

    if (!ticket) {
      return null;
    }

    tickets.push(ticket);
  }

  if (
    !isPositiveInteger(value.page) ||
    !isPositiveInteger(value.pageSize) ||
    !isCount(value.total)
  ) {
    return null;
  }

  return { page: value.page, pageSize: value.pageSize, tickets, total: value.total };
}

function readTicketFromRecord(value: unknown, key: string): Ticket | null {
  return isRecord(value) ? readTicket(value[key]) : null;
}

function readTicket(value: unknown): Ticket | null {
  if (!isRecord(value) || !isRecord(value.client)) {
    return null;
  }

  const client = value.client;

  if (
    typeof client.code !== "string" ||
    typeof client.id !== "string" ||
    typeof client.name !== "string" ||
    (value.description !== null && typeof value.description !== "string") ||
    !isTicketExternalPriority(value.externalPriority) ||
    typeof value.externalReference !== "string" ||
    (value.externalUrl !== null && typeof value.externalUrl !== "string") ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    !isPositiveInteger(value.version)
  ) {
    return null;
  }

  return {
    client: { code: client.code, id: client.id, name: client.name },
    description: value.description,
    externalPriority: value.externalPriority,
    externalReference: value.externalReference,
    externalUrl: value.externalUrl,
    id: value.id,
    title: value.title,
    version: value.version,
  };
}

async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const value = await response.json();

    if (isRecord(value) && typeof value.message === "string") {
      return value.message;
    }
  } catch {
    // The response body is optional for an HTTP error.
  }

  return "No fue posible completar la operación.";
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTicketExternalPriority(value: unknown): value is TicketExternalPriority {
  return (ticketExternalPriorities as readonly string[]).includes(value as string);
}
