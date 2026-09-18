import { headers } from "next/headers";

import { getServerSessionFromCookie } from "./auth-session-request";
import type { PortalSession } from "./auth-session-request";

export { getServerSessionFromCookie } from "./auth-session-request";
export type { PortalSession } from "./auth-session-request";

export async function getServerSession(): Promise<PortalSession | null> {
  const requestHeaders = await headers();

  return getServerSessionFromCookie(requestHeaders.get("cookie"));
}
