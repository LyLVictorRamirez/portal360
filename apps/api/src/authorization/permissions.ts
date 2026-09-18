export const authorizationPermissionKeys = [
  "app.access",
  "authorization.users.read",
  "authorization.users.manage",
  "authorization.roles.read",
  "authorization.roles.manage",
] as const;

export type AuthorizationPermission = (typeof authorizationPermissionKeys)[number];

export const appAccessPermission: AuthorizationPermission = "app.access";

export function isAuthorizationPermission(value: string): value is AuthorizationPermission {
  return (authorizationPermissionKeys as readonly string[]).includes(value);
}
