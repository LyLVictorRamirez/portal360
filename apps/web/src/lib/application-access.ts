import {
  appAccessPermission,
  hasAuthorizationPermission,
  type UserAuthorization,
} from "./authorization.ts";
import type { PortalSession } from "./auth-session";

export type ApplicationAccessState =
  | Readonly<{ kind: "authorized"; authorization: UserAuthorization }>
  | Readonly<{ kind: "sign-in-required" }>
  | Readonly<{ kind: "unauthorized" }>;

export function resolveApplicationAccess(
  session: PortalSession | null,
  authorization: UserAuthorization | null,
): ApplicationAccessState {
  if (!session || !session.user.emailVerified) {
    return { kind: "sign-in-required" };
  }

  if (!authorization || !hasAuthorizationPermission(authorization, appAccessPermission)) {
    return { kind: "unauthorized" };
  }

  return { authorization, kind: "authorized" };
}
