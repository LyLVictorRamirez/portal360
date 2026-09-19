import assert from "node:assert/strict";
import test from "node:test";

import {
  listAuthorizationUsers,
  replaceAuthorizationUserRoles,
} from "./authorization-users-client.ts";

const standardRole = {
  description: "Minimum access.",
  isActive: true,
  isDefault: true,
  key: "estandar",
  kind: "system",
  name: "Estándar",
};

test("lists users through the same-origin authorization API", async () => {
  let requestedUrl = "";

  const result = await listAuthorizationUsers(" pending ", async (input, init) => {
    requestedUrl = input.toString();
    assert.deepEqual(init, { cache: "no-store" });

    return Response.json({
      users: [
        {
          email: "pending@example.test",
          emailVerified: false,
          id: "user-1",
          name: "Pending user",
          roles: [standardRole],
        },
      ],
    });
  });

  assert.equal(requestedUrl, "/api/authorization/users?query=pending");
  assert.equal(result.kind, "success");

  if (result.kind === "success") {
    assert.deepEqual(result.data, [
      {
        email: "pending@example.test",
        emailVerified: false,
        id: "user-1",
        name: "Pending user",
        roles: [standardRole],
      },
    ]);
  }
});

test("treats a revoked browser permission as unauthorized", async () => {
  assert.deepEqual(
    await listAuthorizationUsers("", async () => new Response(null, { status: 403 })),
    { kind: "unauthorized" },
  );
});

test("replaces a user's roles through the scoped user endpoint", async () => {
  let requestedUrl = "";
  let requestInit: RequestInit | undefined;

  const result = await replaceAuthorizationUserRoles(
    "user/1",
    ["estandar", "lider"],
    async (input, init) => {
      requestedUrl = input.toString();
      requestInit = init;

      return Response.json({ roles: [standardRole] });
    },
  );

  assert.equal(requestedUrl, "/api/authorization/users/user%2F1/roles");
  assert.deepEqual(requestInit, {
    body: JSON.stringify({ roleKeys: ["estandar", "lider"] }),
    headers: { "content-type": "application/json" },
    method: "PUT",
  });
  assert.deepEqual(result, { data: [standardRole], kind: "success" });
});
