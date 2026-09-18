import {
  isAuthorizationPermission,
  type AuthorizationRole,
  type AuthorizationRoleKind,
  type UserAuthorization,
} from "./authorization.ts";

const apiOrigin = (process.env.API_ORIGIN ?? "http://localhost:3001").replace(/\/+$/, "");

export async function getServerAuthorizationFromCookie(
  cookie: string | null,
  fetchImplementation: typeof fetch = fetch,
): Promise<UserAuthorization | null> {
  try {
    const response = await fetchImplementation(`${apiOrigin}/api/authorization/me`, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });

    if (!response.ok) {
      return null;
    }

    return toUserAuthorization(await response.json());
  } catch {
    return null;
  }
}

function toUserAuthorization(value: unknown): UserAuthorization | null {
  if (!isRecord(value) || !Array.isArray(value.permissions) || !Array.isArray(value.roles)) {
    return null;
  }

  if (value.permissions.some((permission) => !isAuthorizationPermission(permission))) {
    return null;
  }

  const roles: AuthorizationRole[] = [];

  for (const roleValue of value.roles) {
    const role = toAuthorizationRole(roleValue);

    if (!role) {
      return null;
    }

    roles.push(role);
  }

  return {
    permissions: [...value.permissions],
    roles: roles,
  };
}

function toAuthorizationRole(value: unknown): AuthorizationRole | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.description !== "string" ||
    typeof value.isActive !== "boolean" ||
    typeof value.isDefault !== "boolean" ||
    typeof value.key !== "string" ||
    !isAuthorizationRoleKind(value.kind) ||
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

function isAuthorizationRoleKind(value: unknown): value is AuthorizationRoleKind {
  return value === "custom" || value === "system";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
