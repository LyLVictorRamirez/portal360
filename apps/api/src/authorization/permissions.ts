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
  "tickets.read",
  "tickets.manage",
  "activities.read",
  "activities.manage",
  "activity-categories.manage",
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
