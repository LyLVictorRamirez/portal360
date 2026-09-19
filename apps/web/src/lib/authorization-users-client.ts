import type { AuthorizationRole } from "./authorization.ts";

export type AuthorizationManagedUser = Readonly<{
  email: string;
  emailVerified: boolean;
  id: string;
  name: string;
  roles: AuthorizationRole[];
}>;

export type AuthorizationApiResult<Value> =
  | Readonly<{ data: Value; kind: "success" }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

export async function listAuthorizationUsers(
  query: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<AuthorizationApiResult<AuthorizationManagedUser[]>> {
  const searchParams = new URLSearchParams();
  const normalizedQuery = query.trim();

  if (normalizedQuery) {
    searchParams.set("query", normalizedQuery);
  }

  return requestAuthorizationData(
    `/api/authorization/users${searchParams.size ? `?${searchParams}` : ""}`,
    readAuthorizationUsers,
    fetchImplementation,
  );
}

export async function listAssignableAuthorizationRoles(
  fetchImplementation: typeof fetch = fetch,
): Promise<AuthorizationApiResult<AuthorizationRole[]>> {
  return requestAuthorizationData(
    "/api/authorization/roles",
    readAuthorizationRoles,
    fetchImplementation,
  );
}

export async function replaceAuthorizationUserRoles(
  userId: string,
  roleKeys: string[],
  fetchImplementation: typeof fetch = fetch,
): Promise<AuthorizationApiResult<AuthorizationRole[]>> {
  try {
    const response = await fetchImplementation(
      `/api/authorization/users/${encodeURIComponent(userId)}/roles`,
      {
        body: JSON.stringify({ roleKeys }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      },
    );

    if (response.status === 401 || response.status === 403) {
      return { kind: "unauthorized" };
    }

    if (!response.ok) {
      return { kind: "error", message: await readApiErrorMessage(response) };
    }

    const roles = readRoleListFromRecord(await response.json(), "roles");

    return roles
      ? { data: roles, kind: "success" }
      : { kind: "error", message: "La respuesta de roles no es válida." };
  } catch {
    return { kind: "error", message: "No fue posible guardar las asignaciones de roles." };
  }
}

async function requestAuthorizationData<Value>(
  path: string,
  readValue: (value: unknown) => Value | null,
  fetchImplementation: typeof fetch,
): Promise<AuthorizationApiResult<Value>> {
  try {
    const response = await fetchImplementation(path, { cache: "no-store" });

    if (response.status === 401 || response.status === 403) {
      return { kind: "unauthorized" };
    }

    if (!response.ok) {
      return { kind: "error", message: await readApiErrorMessage(response) };
    }

    const value = readValue(await response.json());

    return value
      ? { data: value, kind: "success" }
      : { kind: "error", message: "La respuesta del servidor no es válida." };
  } catch {
    return { kind: "error", message: "No fue posible conectar con el servidor." };
  }
}

function readAuthorizationUsers(value: unknown): AuthorizationManagedUser[] | null {
  if (!isRecord(value) || !Array.isArray(value.users)) {
    return null;
  }

  const users: AuthorizationManagedUser[] = [];

  for (const userValue of value.users) {
    const user = readAuthorizationUser(userValue);

    if (!user) {
      return null;
    }

    users.push(user);
  }

  return users;
}

function readAuthorizationRoles(value: unknown): AuthorizationRole[] | null {
  return readRoleListFromRecord(value, "roles");
}

function readAuthorizationUser(value: unknown): AuthorizationManagedUser | null {
  if (!isRecord(value) || !Array.isArray(value.roles)) {
    return null;
  }

  if (
    typeof value.email !== "string" ||
    typeof value.emailVerified !== "boolean" ||
    typeof value.id !== "string" ||
    typeof value.name !== "string"
  ) {
    return null;
  }

  const roles = readRoleList(value.roles);

  return roles
    ? {
        email: value.email,
        emailVerified: value.emailVerified,
        id: value.id,
        name: value.name,
        roles,
      }
    : null;
}

function readRoleListFromRecord(value: unknown, key: string): AuthorizationRole[] | null {
  return isRecord(value) && Array.isArray(value[key]) ? readRoleList(value[key]) : null;
}

function readRoleList(value: unknown[]): AuthorizationRole[] | null {
  const roles: AuthorizationRole[] = [];

  for (const roleValue of value) {
    const role = readAuthorizationRole(roleValue);

    if (!role) {
      return null;
    }

    roles.push(role);
  }

  return roles;
}

function readAuthorizationRole(value: unknown): AuthorizationRole | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.description !== "string" ||
    typeof value.isActive !== "boolean" ||
    typeof value.isDefault !== "boolean" ||
    typeof value.key !== "string" ||
    (value.kind !== "custom" && value.kind !== "system") ||
    typeof value.name !== "string"
  ) {
    return null;
  }

  return {
    description: value.description,
    isActive: value.isActive,
    isDefault: value.isDefault,
    key: value.key,
    kind: value.kind,
    name: value.name,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
