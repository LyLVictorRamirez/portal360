export const authorizationPermissionKeys = [
  "app.access",
  "clients.read",
  "clients.manage",
  "clients.settings.manage",
  "projects.read",
  "projects.manage",
  "projects.settings.manage",
  "requirements.read",
  "requirements.manage",
  "requirements.settings.manage",
  "authorization.users.read",
  "authorization.users.manage",
  "authorization.roles.read",
  "authorization.roles.manage",
] as const;

export const appAccessPermission = "app.access";

export type AuthorizationPermission = (typeof authorizationPermissionKeys)[number];
export type AuthorizationRoleKind = "custom" | "system";

export type AuthorizationRole = Readonly<{
  description: string;
  isActive: boolean;
  isDefault: boolean;
  key: string;
  kind: AuthorizationRoleKind;
  name: string;
}>;

export type UserAuthorization = Readonly<{
  permissions: AuthorizationPermission[];
  roles: AuthorizationRole[];
}>;

export function hasAuthorizationPermission(
  authorization: UserAuthorization,
  permission: AuthorizationPermission,
): boolean {
  return authorization.permissions.includes(permission);
}

export function isAuthorizationPermission(value: unknown): value is AuthorizationPermission {
  return (
    typeof value === "string" &&
    authorizationPermissionKeys.includes(value as AuthorizationPermission)
  );
}
