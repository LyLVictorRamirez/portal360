import { headers } from "next/headers";

import { getServerAuthorizationFromCookie } from "./authorization-context-request";
import type { UserAuthorization } from "./authorization";

export { getServerAuthorizationFromCookie } from "./authorization-context-request";
export type { UserAuthorization } from "./authorization";

export async function getServerAuthorization(): Promise<UserAuthorization | null> {
  const requestHeaders = await headers();

  return getServerAuthorizationFromCookie(requestHeaders.get("cookie"));
}
