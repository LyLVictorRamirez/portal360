import type { AuthorizationPermission } from "./permissions.js";

export type AuthorizationRoleKind = "custom" | "system";

export interface AuthorizationRole {
  description: string;
  isActive: boolean;
  isDefault: boolean;
  key: string;
  kind: AuthorizationRoleKind;
  name: string;
}

export interface UserAuthorization {
  permissions: AuthorizationPermission[];
  roles: AuthorizationRole[];
}

export interface AuthorizationRequestContext {
  authorization: UserAuthorization;
  userId: string;
}
