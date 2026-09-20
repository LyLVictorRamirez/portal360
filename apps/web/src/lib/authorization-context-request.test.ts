import assert from "node:assert/strict";
import test from "node:test";

import { getServerAuthorizationFromCookie } from "./authorization-context-request.ts";

const validAuthorizationResponse = {
  permissions: [
    "app.access",
    "authorization.users.read",
    "projects.read",
    "requirements.read",
    "requirements.manage",
    "requirements.settings.manage",
  ],
  roles: [
    {
      description: "Minimum access.",
      isActive: true,
      isDefault: true,
      key: "estandar",
      kind: "system",
      name: "Estándar",
    },
  ],
};

test("forwards the server cookie and keeps only the authorization contract", async () => {
  let requestedUrl = "";
  let requestInit: RequestInit | undefined;

  const authorization = await getServerAuthorizationFromCookie(
    "better-auth.session_token=token",
    async (input, init) => {
      requestedUrl = input.toString();
      requestInit = init;

      return Response.json({
        ...validAuthorizationResponse,
        internalUserId: "must-not-reach-the-application",
      });
    },
  );

  assert.match(requestedUrl, /\/api\/authorization\/me$/);
  assert.deepEqual(requestInit, {
    cache: "no-store",
    headers: { cookie: "better-auth.session_token=token" },
  });
  assert.deepEqual(authorization, validAuthorizationResponse);
});

test("fails closed for unavailable, unauthorized, or malformed authorization responses", async () => {
  assert.equal(
    await getServerAuthorizationFromCookie(null, async () => new Response(null, { status: 401 })),
    null,
  );
  assert.equal(
    await getServerAuthorizationFromCookie(null, async () => new Response(null, { status: 403 })),
    null,
  );
  assert.equal(
    await getServerAuthorizationFromCookie(null, async () => Response.json({ permissions: [] })),
    null,
  );
  assert.equal(
    await getServerAuthorizationFromCookie(null, async () => {
      throw new Error("API unavailable");
    }),
    null,
  );
});
