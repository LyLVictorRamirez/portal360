import assert from "node:assert/strict";
import test from "node:test";

import { resolveApplicationAccess } from "./application-access.ts";
import type { UserAuthorization } from "./authorization.ts";
import type { PortalSession } from "./auth-session.ts";

const verifiedSession: PortalSession = {
  session: {
    expiresAt: "2026-10-18T12:00:00.000Z",
    id: "session-1",
    userId: "user-1",
  },
  user: {
    email: "member@example.test",
    emailVerified: true,
    id: "user-1",
    image: null,
    name: "Member",
  },
};

const minimumAuthorization: UserAuthorization = {
  permissions: ["app.access"],
  roles: [],
};

test("requires sign-in when there is no verified session", () => {
  assert.deepEqual(resolveApplicationAccess(null, minimumAuthorization), {
    kind: "sign-in-required",
  });
  assert.deepEqual(
    resolveApplicationAccess(
      {
        ...verifiedSession,
        user: { ...verifiedSession.user, emailVerified: false },
      },
      minimumAuthorization,
    ),
    { kind: "sign-in-required" },
  );
});

test("denies a verified session without app.access", () => {
  assert.deepEqual(resolveApplicationAccess(verifiedSession, { permissions: [], roles: [] }), {
    kind: "unauthorized",
  });
});

test("allows a verified session with app.access", () => {
  assert.deepEqual(resolveApplicationAccess(verifiedSession, minimumAuthorization), {
    authorization: minimumAuthorization,
    kind: "authorized",
  });
});
