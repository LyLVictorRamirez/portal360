import { headers } from "next/headers";

const apiOrigin = (process.env.API_ORIGIN ?? "http://localhost:3001").replace(/\/+$/, "");

export interface PortalSession {
  session: {
    expiresAt: string;
    id: string;
    userId: string;
  };
  user: {
    email: string;
    emailVerified: boolean;
    id: string;
    image: string | null;
    name: string;
  };
}

export async function getServerSession(): Promise<PortalSession | null> {
  const requestHeaders = await headers();

  return getServerSessionFromCookie(requestHeaders.get("cookie"));
}

export async function getServerSessionFromCookie(
  cookie: string | null,
  fetchImplementation: typeof fetch = fetch,
): Promise<PortalSession | null> {
  try {
    const response = await fetchImplementation(`${apiOrigin}/api/auth/get-session`, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });

    if (!response.ok) {
      return null;
    }

    return toPortalSession(await response.json());
  } catch {
    return null;
  }
}

function toPortalSession(value: unknown): PortalSession | null {
  if (!isRecord(value) || !isRecord(value.session) || !isRecord(value.user)) {
    return null;
  }

  const { session, user } = value;

  if (
    typeof session.expiresAt !== "string" ||
    typeof session.id !== "string" ||
    typeof session.userId !== "string" ||
    typeof user.email !== "string" ||
    typeof user.emailVerified !== "boolean" ||
    typeof user.id !== "string" ||
    (typeof user.image !== "string" && user.image !== null) ||
    typeof user.name !== "string"
  ) {
    return null;
  }

  return {
    session: {
      expiresAt: session.expiresAt,
      id: session.id,
      userId: session.userId,
    },
    user: {
      email: user.email,
      emailVerified: user.emailVerified,
      id: user.id,
      image: user.image,
      name: user.name,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
