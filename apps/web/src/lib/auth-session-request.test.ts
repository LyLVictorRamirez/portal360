import assert from "node:assert/strict";
import test from "node:test";

import { getServerSessionFromCookie } from "./auth-session-request.ts";

const validSessionResponse = {
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

test("forwards the request cookie and keeps only the session contract", async () => {
  let requestedUrl = "";
  let requestInit: RequestInit | undefined;

  const session = await getServerSessionFromCookie(
    "better-auth.session_token=token",
    async (input, init) => {
      requestedUrl = input.toString();
      requestInit = init;

      return Response.json({
        ...validSessionResponse,
        internalToken: "must-not-reach-the-application",
      });
    },
  );

  assert.match(requestedUrl, /\/api\/auth\/get-session$/);
  assert.deepEqual(requestInit, {
    cache: "no-store",
    headers: { cookie: "better-auth.session_token=token" },
  });
  assert.deepEqual(session, validSessionResponse);
});

test("fails closed for failed, malformed, or unavailable session responses", async () => {
  assert.equal(
    await getServerSessionFromCookie(null, async () => new Response(null, { status: 401 })),
    null,
  );
  assert.equal(
    await getServerSessionFromCookie(null, async () => Response.json({ user: {} })),
    null,
  );
  assert.equal(
    await getServerSessionFromCookie(null, async () => {
      throw new Error("API unavailable");
    }),
    null,
  );
});
