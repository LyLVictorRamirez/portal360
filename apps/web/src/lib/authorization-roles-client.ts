import {
  isAuthorizationPermission,
  type AuthorizationPermission,
  type AuthorizationRole,
} from "./authorization.ts";

export type AuthorizationPermissionDefinition = Readonly<{
  description: string;
  key: AuthorizationPermission;
  name: string;
}>;

export type AuthorizationRoleDetails = AuthorizationRole &
  Readonly<{
    permissions: AuthorizationPermission[];
  }>;

export type AuthorizationRoleCatalog = Readonly<{
  permissions: AuthorizationPermissionDefinition[];
  roles: AuthorizationRoleDetails[];
}>;

export type CreateAuthorizationRoleInput = Readonly<{
  description: string;
  key: string;
  name: string;
  permissionKeys: readonly AuthorizationPermission[];
}>;

export type UpdateAuthorizationRoleInput = Readonly<{
  description: string;
  isActive?: boolean;
  name: string;
  permissionKeys: readonly AuthorizationPermission[];
}>;

export type AuthorizationApiResult<Value> =
  | Readonly<{ data: Value; kind: "success" }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

export async function listAuthorizationRoleCatalog(
  fetchImplementation: typeof fetch = fetch,
): Promise<AuthorizationApiResult<AuthorizationRoleCatalog>> {
  return requestAuthorizationData(
    "/api/authorization/roles",
    readAuthorizationRoleCatalog,
    fetchImplementation,
  );
}

export async function createAuthorizationRole(
  input: CreateAuthorizationRoleInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<AuthorizationApiResult<AuthorizationRoleDetails>> {
  return mutateAuthorizationRole("/api/authorization/roles", "POST", input, fetchImplementation);
}

export async function updateAuthorizationRole(
  roleKey: string,
  input: UpdateAuthorizationRoleInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<AuthorizationApiResult<AuthorizationRoleDetails>> {
  return mutateAuthorizationRole(
    `/api/authorization/roles/${encodeURIComponent(roleKey)}`,
    "PATCH",
    input,
    fetchImplementation,
  );
}

export async function deleteAuthorizationRole(
  roleKey: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<AuthorizationApiResult<void>> {
  try {
    const response = await fetchImplementation(
      `/api/authorization/roles/${encodeURIComponent(roleKey)}`,
      { method: "DELETE" },
    );

    if (response.status === 401 || response.status === 403) {
      return { kind: "unauthorized" };
    }

    if (!response.ok) {
      return { kind: "error", message: await readApiErrorMessage(response) };
    }

    return { data: undefined, kind: "success" };
  } catch {
    return { kind: "error", message: "No fue posible eliminar el rol." };
  }
}

async function mutateAuthorizationRole(
  path: string,
  method: "PATCH" | "POST",
  input: CreateAuthorizationRoleInput | UpdateAuthorizationRoleInput,
  fetchImplementation: typeof fetch,
): Promise<AuthorizationApiResult<AuthorizationRoleDetails>> {
  try {
    const response = await fetchImplementation(path, {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" },
      method,
    });

    if (response.status === 401 || response.status === 403) {
      return { kind: "unauthorized" };
    }

    if (!response.ok) {
      return { kind: "error", message: await readApiErrorMessage(response) };
    }

    const role = readRoleFromRecord(await response.json(), "role");

    return role
      ? { data: role, kind: "success" }
      : { kind: "error", message: "La respuesta del rol no es válida." };
  } catch {
    return { kind: "error", message: "No fue posible guardar el rol." };
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

function readAuthorizationRoleCatalog(value: unknown): AuthorizationRoleCatalog | null {
  if (!isRecord(value) || !Array.isArray(value.permissions) || !Array.isArray(value.roles)) {
    return null;
  }

  const permissions: AuthorizationPermissionDefinition[] = [];
  const roles: AuthorizationRoleDetails[] = [];

  for (const permissionValue of value.permissions) {
    const permission = readAuthorizationPermissionDefinition(permissionValue);

    if (!permission) {
      return null;
    }

    permissions.push(permission);
  }

  for (const roleValue of value.roles) {
    const role = readAuthorizationRoleDetails(roleValue);

    if (!role) {
      return null;
    }

    roles.push(role);
  }

  return { permissions, roles };
}

function readAuthorizationPermissionDefinition(
  value: unknown,
): AuthorizationPermissionDefinition | null {
  if (!isRecord(value) || !isAuthorizationPermission(value.key)) {
    return null;
  }

  if (typeof value.description !== "string" || typeof value.name !== "string") {
    return null;
  }

  return { description: value.description, key: value.key, name: value.name };
}

function readRoleFromRecord(value: unknown, key: string): AuthorizationRoleDetails | null {
  return isRecord(value) ? readAuthorizationRoleDetails(value[key]) : null;
}

function readAuthorizationRoleDetails(value: unknown): AuthorizationRoleDetails | null {
  if (!isRecord(value) || !Array.isArray(value.permissions)) {
    return null;
  }

  const role = readAuthorizationRole(value);

  if (!role || value.permissions.some((permission) => !isAuthorizationPermission(permission))) {
    return null;
  }

  return { ...role, permissions: [...value.permissions] };
}

function readAuthorizationRole(value: Record<string, unknown>): AuthorizationRole | null {
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
