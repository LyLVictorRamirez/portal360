import assert from "node:assert/strict";
import test from "node:test";

import {
  createAuthorizationRole,
  deleteAuthorizationRole,
  listAuthorizationRoleCatalog,
  updateAuthorizationRole,
} from "./authorization-roles-client.ts";

const standardRole = {
  description: "Acceso mínimo a la aplicación.",
  isActive: true,
  isDefault: true,
  key: "estandar",
  kind: "system",
  name: "Estándar",
  permissions: ["app.access"],
};

const permissions = [
  {
    description: "Permite entrar a la aplicación.",
    key: "app.access",
    name: "Acceder a la aplicación",
  },
];

test("lists the role catalog through the same-origin authorization API", async () => {
  let requestedUrl = "";

  const result = await listAuthorizationRoleCatalog(async (input, init) => {
    requestedUrl = input.toString();
    assert.deepEqual(init, { cache: "no-store" });

    return Response.json({ permissions, roles: [standardRole] });
  });

  assert.equal(requestedUrl, "/api/authorization/roles");
  assert.deepEqual(result, { data: { permissions, roles: [standardRole] }, kind: "success" });
});

test("creates and updates roles through the scoped role endpoints", async () => {
  const createInput = {
    description: "Puede consultar indicadores.",
    key: "analista",
    name: "Analista",
    permissionKeys: ["app.access"] as const,
  };
  const updateInput = {
    description: "Puede consultar indicadores y usuarios.",
    isActive: false,
    name: "Analista senior",
    permissionKeys: ["app.access", "authorization.users.read"] as const,
  };
  const requests: Array<{ init: RequestInit | undefined; url: string }> = [];

  const fetchImplementation: typeof fetch = async (input, init) => {
    requests.push({ init, url: input.toString() });
    return Response.json({ role: standardRole });
  };

  assert.deepEqual(await createAuthorizationRole(createInput, fetchImplementation), {
    data: standardRole,
    kind: "success",
  });
  assert.deepEqual(await updateAuthorizationRole("analista/1", updateInput, fetchImplementation), {
    data: standardRole,
    kind: "success",
  });
  assert.deepEqual(requests, [
    {
      init: {
        body: JSON.stringify(createInput),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
      url: "/api/authorization/roles",
    },
    {
      init: {
        body: JSON.stringify(updateInput),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      },
      url: "/api/authorization/roles/analista%2F1",
    },
  ]);
});

test("deletes a custom role and treats a revoked permission as unauthorized", async () => {
  let requestedUrl = "";
  let requestInit: RequestInit | undefined;

  const deleted = await deleteAuthorizationRole("analista/1", async (input, init) => {
    requestedUrl = input.toString();
    requestInit = init;
    return new Response(null, { status: 204 });
  });

  assert.equal(requestedUrl, "/api/authorization/roles/analista%2F1");
  assert.deepEqual(requestInit, { method: "DELETE" });
  assert.deepEqual(deleted, { data: undefined, kind: "success" });
  assert.deepEqual(
    await deleteAuthorizationRole("analista", async () => new Response(null, { status: 403 })),
    { kind: "unauthorized" },
  );
});
