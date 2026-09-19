import assert from "node:assert/strict";
import test from "node:test";

import {
  createClient,
  deleteClient,
  getClientCodeSettings,
  listClients,
  updateClient,
  updateClientCodeSettings,
} from "./clients-client.ts";

const client = {
  code: "CLI-001",
  id: "f6323093-e2fb-4875-a787-d1542064d138",
  isActive: true,
  name: "Cliente Uno",
  version: 1,
};

test("lists Clients through the same-origin API with search and status", async () => {
  let requestedUrl = "";

  const result = await listClients(
    { page: 2, query: "  cli-001  ", status: "inactive" },
    async (input, init) => {
      requestedUrl = input.toString();
      assert.deepEqual(init, { cache: "no-store" });
      return Response.json({ clients: [client], page: 2, pageSize: 25, total: 26 });
    },
  );

  assert.equal(requestedUrl, "/api/clients?page=2&query=cli-001&status=inactive");
  assert.deepEqual(result, {
    data: { clients: [client], page: 2, pageSize: 25, total: 26 },
    kind: "success",
  });
});

test("creates, updates, and deletes Clients through scoped endpoints", async () => {
  const requests: Array<{ init: RequestInit | undefined; url: string }> = [];
  const fetchImplementation: typeof fetch = async (input, init) => {
    requests.push({ init, url: input.toString() });

    if (init?.method === "DELETE") {
      return new Response(null, { status: 204 });
    }

    return Response.json({ client });
  };

  assert.deepEqual(await createClient({ name: "Cliente Uno" }, fetchImplementation), {
    data: client,
    kind: "success",
  });
  assert.deepEqual(
    await updateClient("f632/1", { isActive: false, version: 1 }, fetchImplementation),
    { data: client, kind: "success" },
  );
  assert.deepEqual(await deleteClient("f632/1", fetchImplementation), {
    data: undefined,
    kind: "success",
  });
  assert.deepEqual(requests, [
    {
      init: {
        body: JSON.stringify({ name: "Cliente Uno" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
      url: "/api/clients",
    },
    {
      init: {
        body: JSON.stringify({ isActive: false, version: 1 }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      },
      url: "/api/clients/f632%2F1",
    },
    {
      init: { method: "DELETE" },
      url: "/api/clients/f632%2F1",
    },
  ]);
});

test("reads code settings and distinguishes unauthorized, validation, and conflict errors", async () => {
  const settings = await getClientCodeSettings(async (input, init) => {
    assert.equal(input.toString(), "/api/clients/settings/code");
    assert.deepEqual(init, { cache: "no-store" });
    return Response.json({
      settings: { codeLength: 6, nextSequence: "2", prefix: "CLI", version: 2 },
    });
  });

  assert.deepEqual(settings, {
    data: { codeLength: 6, nextSequence: "2", prefix: "CLI", version: 2 },
    kind: "success",
  });
  assert.deepEqual(
    await createClient({ name: "Cliente Uno" }, async () => new Response(null, { status: 403 })),
    { kind: "unauthorized" },
  );
  assert.deepEqual(
    await updateClientCodeSettings(
      { codeLength: 6, nextSequence: "2", prefix: "CLI", version: 1 },
      async () => Response.json({ message: "El consecutivo es inválido." }, { status: 400 }),
    ),
    { kind: "validation", message: "El consecutivo es inválido." },
  );
  assert.deepEqual(
    await updateClient("f632", { name: "Cliente Dos", version: 1 }, async () =>
      Response.json({ message: "Recarga el Cliente." }, { status: 409 }),
    ),
    { kind: "conflict", message: "Recarga el Cliente." },
  );
});
